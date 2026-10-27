"use strict";

const { analyzeRoute } = require("./progressive-router");
const { loadCrmKnowledge } = require("./crm-knowledge");
const { loadNewsState } = require("./news-store");
const { buildDailyBriefing } = require("./news-filter");
const { buildLeadgenPlan } = require("./leadgen-orchestrator");
const { executeBusinessStep } = require("./business-worker");
const { appendAuditEvent } = require("./audit-log");
const { workWindowStatus } = require("./work-window");
const {
  withState,
  createTask,
  touchTask,
  taskMatchesKnowledge,
  taskConflicts,
  insertKnowledgeKeys,
  canPreempt,
} = require("./task-store");

const HEARTBEAT_TEMPLATES = [
  {
    route: "ops_diagnosis",
    primary_intent: "ops_diagnosis",
    priority: 20,
    dedupe_keys: ["cycle:ops_diagnosis"],
    steps: ["check_runtime", "check_blockers", "summarize"],
  },
  {
    route: "crm_status",
    primary_intent: "crm_status",
    priority: 25,
    dedupe_keys: ["cycle:crm_status"],
    steps: ["inspect_pipeline", "inspect_done", "inspect_followups"],
  },
  {
    route: "lead_capture",
    primary_intent: "lead_search",
    priority: 30,
    dedupe_keys: ["cycle:lead_search"],
    steps: ["plan_leadgen", "dedupe_against_crm", "discover_one_lead"],
  },
  {
    route: "lead_capture",
    primary_intent: "lead_enrich",
    priority: 35,
    dedupe_keys: ["cycle:lead_enrich"],
    steps: ["pick_one_pending_lead", "dedupe_against_done", "enrich_one_contact"],
  },
  {
    route: "lead_capture",
    primary_intent: "email_draft",
    priority: 40,
    dedupe_keys: ["cycle:email_draft"],
    steps: ["pick_best_lead", "check_existing_draft", "prepare_outreach"],
  },
  {
    route: "ops_diagnosis",
    primary_intent: "news_scan",
    priority: 45,
    dedupe_keys: ["cycle:news_scan"],
    steps: ["collect_news", "filter_news", "prepare_briefing"],
  },
  {
    route: "client_email_listen",
    primary_intent: "client_email_triage",
    priority: 50,
    dedupe_keys: ["cycle:client_email_triage"],
    steps: ["scan_replies_readonly", "rank_priority", "prepare_followups"],
  },
  {
    route: "ops_diagnosis",
    primary_intent: "backup_check",
    priority: 55,
    dedupe_keys: ["cycle:backup_check"],
    steps: ["check_backup_paths", "check_recent_state", "report_missing_backup"],
  },
  {
    route: "ops_diagnosis",
    primary_intent: "watchdog_check",
    priority: 60,
    dedupe_keys: ["cycle:watchdog_check"],
    steps: ["check_worker_age", "check_blocked_tasks", "report_stalls"],
  },
];

const DEFAULT_HEARTBEAT_SECTORS = [
  { sector: "restaurants", query: "restaurants" },
  { sector: "hotels", query: "boutique hotels" },
  { sector: "architects", query: "architects" },
  { sector: "fiduciaries", query: "fiduciaries" },
  { sector: "clinics", query: "clinics" },
];

function rankTask(task) {
  const sourceBoost = task.agent_role === "concierge" || task.source === "chat" ? 1000 : 0;
  const businessBoost = task.route === "lead_capture" ? 500 : 0;
  const clientEmailBoost = task.primary_intent === "client_email_triage" ? 420 : 0;
  const supervisorBoost = task.agent_role === "supervisor" ? 250 : 0;
  const workerBoost = task.agent_role === "worker" ? 300 : 0;
  const reviewerBoost = task.agent_role === "reviewer" ? 220 : 0;
  const suspendedBoost = task.status === "suspended" ? 100 : 0;
  return sourceBoost + businessBoost + clientEmailBoost + supervisorBoost + workerBoost + reviewerBoost + suspendedBoost - (task.priority || 0);
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => rankTask(b) - rankTask(a) || String(a.created_at).localeCompare(String(b.created_at)));
}

function canonicalTargetKey(message) {
  const tokens = String(message || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => ![
      "cerca", "trova", "scrivi", "prepara", "email", "bozza", "lead", "nuovi", "nuovo",
      "poi", "e", "il", "lo", "la", "i", "gli", "le", "a", "di", "per", "piu", "più",
      "al", "del", "della", "dei", "degli", "delle", "se", "ok", "test", "heartbeat",
      "hertbreth", "hertbret", "arricchisci", "arricchire", "crea", "caldo", "aggiorna", "crm",
    ].includes(token));

  if (!tokens.length) return null;
  return `target:${[...new Set(tokens)].sort().join(" ")}`;
}

function canonicalRequestKey(message) {
  const normalized = String(message || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return normalized ? `request:${normalized}` : null;
}

function buildDedupeKeys(message, analysis) {
  const keys = new Set();
  if (analysis.route.name === "lead_capture") {
    const targetKey = canonicalTargetKey(message);
    const requestKey = canonicalRequestKey(message);
    if (targetKey) keys.add(targetKey);
    if (requestKey) keys.add(requestKey);
    return [...keys];
  }

  if (analysis.primaryIntent) keys.add(`intent:${analysis.primaryIntent}`);
  for (const intent of analysis.secondaryIntents || []) keys.add(`intent:${intent}`);
  return [...keys];
}

function refreshKnowledge(state) {
  const crm = loadCrmKnowledge();
  const newsState = loadNewsState();
  const newsBriefing = buildDailyBriefing(newsState.items);
  state.knowledge = {
    crmKeys: crm.crmKeys,
    doneKeys: [...new Set([...(state.knowledge.doneKeys || []), ...(crm.doneKeys || [])])],
    runningKeys: crm.runningKeys,
    sourcePath: crm.sourcePath,
    pipelineSource: crm.pipelineSource,
    records: crm.records,
  };
  state.news = {
    lastScanAt: newsState.updated_at,
    count: newsState.items.length,
    topTitles: newsBriefing.summary.top.map((item) => item.title).slice(0, 3),
  };
}

function makeTaskFromChat({ message, language, analysis }) {
  return createTask({
    source: "chat",
    route: analysis.route.name,
    language,
    priority: 100,
    primary_intent: analysis.primaryIntent,
    secondary_intents: analysis.secondaryIntents,
    dedupe_keys: buildDedupeKeys(message, analysis),
    message,
    steps: ["interpret", "execute", "finalize"],
    metadata: {
      intents: analysis.intents,
    },
  });
}

function makeTaskFromPlan(plan, context = {}) {
  const agentRole = context.agent_role || (context.source === "chat" ? "concierge" : (plan.model_profile === "nemotron" ? "reviewer" : "worker"));
  return createTask({
    source: context.source || "chat",
    route: plan.route,
    language: context.language || "it",
    priority: context.priority ?? 100,
    primary_intent: plan.primary_intent,
    secondary_intents: plan.secondary_intents || [],
    dedupe_keys: [
      `intent:${plan.primary_intent || plan.route}`,
      ...(plan.secondary_intents || []).map((intent) => `intent:${intent}`),
    ],
    message: context.message || plan.route,
    model_profile: plan.model_profile || "local-fast",
    agent_role: agentRole,
    steps: ["interpret", "execute", "finalize"],
    metadata: {
      plan,
    },
  });
}

function heartbeatLeadLimit() {
  const raw = Number.parseInt(process.env.LEADGEN_HEARTBEAT_LIMIT || "1", 10);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(10, raw));
}

function parseHeartbeatSectors() {
  const raw = String(process.env.LEADGEN_HEARTBEAT_SECTORS || "").trim();
  if (!raw) return DEFAULT_HEARTBEAT_SECTORS;
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [sector, query] = item.split(":").map((part) => String(part || "").trim());
      return {
        sector,
        query: query || sector,
      };
    })
    .filter((item) => item.sector);
  return parsed.length ? parsed : DEFAULT_HEARTBEAT_SECTORS;
}

function heartbeatLeadgenInput(cursor = 0) {
  const limit = heartbeatLeadLimit();
  const country = String(process.env.LEADGEN_HEARTBEAT_COUNTRY || "CH").trim() || "CH";
  const rotationEnabled = String(process.env.LEADGEN_HEARTBEAT_ROTATION || "on").trim().toLowerCase() !== "off";
  const sectors = parseHeartbeatSectors();
  const picked = rotationEnabled
    ? sectors[Math.abs(Number(cursor) || 0) % sectors.length]
    : {
        sector: String(process.env.LEADGEN_HEARTBEAT_SECTOR || sectors[0].sector).trim() || sectors[0].sector,
        query: String(process.env.LEADGEN_HEARTBEAT_QUERY || sectors[0].query).trim() || sectors[0].query,
      };
  const sector = picked.sector;
  const query = picked.query || sector;
  return {
    country,
    sector,
    query,
    limit,
    message: `Cerca ${limit} lead ${query} ${country}`,
  };
}

function buildHeartbeatMetadata(template, cursor = 0) {
  const metadata = {
    heartbeat_template: template.primary_intent,
  };

  if (template.route !== "lead_capture") return metadata;

  const leadgenInput = heartbeatLeadgenInput(cursor);
  metadata.micro_batch = {
    enabled: true,
    unit: "lead",
    limit: leadgenInput.limit,
    writes_require_confirmation: true,
  };
  metadata.leadgen_plan = buildLeadgenPlan(leadgenInput);
  return metadata;
}

function refreshHeartbeatDuplicate(duplicate, template, candidate) {
  if (!duplicate || duplicate.source !== "heartbeat") return duplicate;
  if (duplicate.status !== "queued") return duplicate;
  duplicate.steps = candidate.steps;
  duplicate.metadata = {
    ...(duplicate.metadata || {}),
    ...candidate.metadata,
    heartbeat_migrated_at: new Date().toISOString(),
  };
  duplicate.priority = template.priority;
  duplicate.agent_role = candidate.agent_role;
  touchTask(duplicate);
  return duplicate;
}

function persistentKnowledgeKeys(task) {
  const keys = task.dedupe_keys || [];
  if (task.source !== "heartbeat") return keys;
  return keys.filter((key) => !String(key || "").startsWith("cycle:"));
}

function enqueueHeartbeatCycle(state, language = "it") {
  const created = [];
  const hasPendingHeartbeatWork = state.tasks.some((task) =>
    task.source === "heartbeat"
    && ["queued", "running", "suspended"].includes(task.status)
    && (task.dedupe_keys || []).some((key) => String(key || "").startsWith("cycle:"))
  );
  if (hasPendingHeartbeatWork) {
    return created;
  }

  const cycleCursor = Number.isFinite(state.heartbeatCursor) ? state.heartbeatCursor : 0;
  for (const template of HEARTBEAT_TEMPLATES) {
    const task = createTask({
      source: "heartbeat",
      route: template.route,
      language,
      priority: template.priority,
      primary_intent: template.primary_intent,
      dedupe_keys: template.dedupe_keys,
      steps: template.steps,
      message: `[cycle] ${template.primary_intent}`,
      agent_role: inferHeartbeatAgentRole(template),
      metadata: buildHeartbeatMetadata(template, cycleCursor),
    });
    const duplicate = state.tasks.find((item) =>
      ["queued", "running", "suspended"].includes(item.status) && taskConflicts(item, task)
    );
    if (duplicate) {
      refreshHeartbeatDuplicate(duplicate, template, task);
      continue;
    }
    state.tasks.push(task);
    created.push(task);
    appendAuditEvent({
      actor: "supervisor",
      action: "task_queued",
      target: template.primary_intent,
      task_id: task.id,
      status: task.status,
      meta: { route: task.route, role: task.agent_role, source: task.source },
    });
  }
  state.cycleCount += 1;
  state.heartbeatCursor = cycleCursor + 1;
  return created;
}

function inferHeartbeatAgentRole(template) {
  if (template.primary_intent === "news_scan" || template.primary_intent === "email_draft") return "reviewer";
  if (template.primary_intent === "client_email_triage") return "worker";
  if (template.route === "lead_capture") return "worker";
  return "supervisor";
}

function suspendCurrentTask(state, reasonTaskId) {
  if (!state.currentTaskId) return null;
  const task = state.tasks.find((item) => item.id === state.currentTaskId);
  const reasonTask = typeof reasonTaskId === "object"
    ? reasonTaskId
    : state.tasks.find((item) => item.id === reasonTaskId);
  if (!task || task.status !== "running" || !canPreempt(task, reasonTask)) return null;
  task.status = "suspended";
  task.resume_after = reasonTask.id || reasonTaskId;
  touchTask(task);
  state.currentTaskId = null;
  appendAuditEvent({
    actor: "supervisor",
    action: "task_suspended",
    target: task.primary_intent,
    task_id: task.id,
    status: task.status,
    reason: `preempted_by:${reasonTask.id || reasonTaskId}`,
    meta: { preemptor_role: reasonTask.agent_role, preemptor_intent: reasonTask.primary_intent },
  });
  return task;
}

function pickNextTask(state) {
  const runnable = state.tasks.filter((task) => task.status === "queued" || task.status === "suspended");
  const [next] = sortTasks(runnable);
  return next || null;
}

function activateTask(state, task) {
  if (!task) return null;
  task.status = "running";
  task.resume_after = null;
  touchTask(task);
  state.currentTaskId = task.id;
  if (task.source === "chat") state.currentForegroundTaskId = task.id;
  appendAuditEvent({
    actor: task.agent_role || "worker",
    action: "task_started",
    target: task.primary_intent,
    task_id: task.id,
    status: task.status,
    meta: { route: task.route, source: task.source },
  });
  return task;
}

function stepRunningTask(state, options = {}) {
  const task = state.tasks.find((item) => item.id === state.currentTaskId);
  if (!task || task.status !== "running") return null;
  const totalSteps = Math.max(1, task.steps.length || 1);
  const currentStepName = task.steps[Math.min(task.current_step, totalSteps - 1)] || "work";
  let businessResult = null;

  try {
    businessResult = executeBusinessStep(task, currentStepName);
    if (businessResult) {
      task.metadata = task.metadata || {};
      task.metadata.execution_results = Array.isArray(task.metadata.execution_results)
        ? task.metadata.execution_results
        : [];
      task.metadata.execution_results.push({
        step: currentStepName,
        at: new Date().toISOString(),
        ...businessResult,
      });
      appendAuditEvent({
        actor: task.agent_role || "worker",
        action: businessResult.ok ? "business_step_done" : "business_step_noop",
        target: task.primary_intent,
        task_id: task.id,
        status: task.status,
        meta: { step: currentStepName, result: businessResult },
      });
    }
  } catch (error) {
    businessResult = {
      ok: false,
      error: error.message,
      step: currentStepName,
    };
    task.metadata = task.metadata || {};
    task.metadata.execution_results = Array.isArray(task.metadata.execution_results)
      ? task.metadata.execution_results
      : [];
    task.metadata.execution_results.push({
      at: new Date().toISOString(),
      ...businessResult,
    });
    appendAuditEvent({
      actor: task.agent_role || "worker",
      action: "business_step_error",
      target: task.primary_intent,
      task_id: task.id,
      status: task.status,
      reason: error.message,
      meta: { step: currentStepName },
    });
  }
  const completed = task.current_step >= totalSteps - 1 || options.forceComplete;

  if (completed) {
    task.status = "done";
    task.current_step = totalSteps;
    touchTask(task);
    insertKnowledgeKeys(state, persistentKnowledgeKeys(task), "doneKeys");
    state.currentTaskId = null;
    if (state.currentForegroundTaskId === task.id) state.currentForegroundTaskId = null;
    appendAuditEvent({
      actor: task.agent_role || "worker",
      action: "task_done",
      target: task.primary_intent,
      task_id: task.id,
      status: task.status,
      meta: { step: currentStepName, route: task.route },
    });

    const suspended = sortTasks(state.tasks.filter((item) => item.status === "suspended"));
    if (suspended.length) {
      activateTask(state, suspended[0]);
    }

    return {
      task,
      event: "completed",
      step: currentStepName,
      business_result: businessResult,
    };
  }

  task.current_step += 1;
  touchTask(task);
  appendAuditEvent({
    actor: task.agent_role || "worker",
    action: "task_progress",
    target: task.primary_intent,
    task_id: task.id,
    status: task.status,
    meta: { step: currentStepName, current_step: task.current_step },
  });
  return {
    task,
    event: "progressed",
    step: currentStepName,
    business_result: businessResult,
  };
}

function ingestChatTask({ message, language = "it", analysis }) {
  return withState((state) => {
    refreshKnowledge(state);
    const task = makeTaskFromChat({ message, language, analysis });
    if (taskMatchesKnowledge(task, state.knowledge)) {
      appendAuditEvent({
        actor: "concierge",
        action: "task_blocked",
        target: task.primary_intent,
        task_id: task.id,
        status: "blocked",
        reason: "known_in_crm_or_done",
      });
      return {
        task: createTask({
          ...task,
          status: "blocked",
          metadata: {
            ...task.metadata,
            blocked_reason: "known_in_crm_or_done",
          },
        }),
        duplicate: true,
        suspended: null,
      };
    }
    const duplicate = state.tasks.find((item) =>
      ["queued", "running", "suspended", "done"].includes(item.status)
      && (taskConflicts(item, task) || item.message === task.message)
    );

    if (duplicate) {
      appendAuditEvent({
        actor: "concierge",
        action: "task_duplicate",
        target: task.primary_intent,
        task_id: duplicate.id,
        status: duplicate.status,
        reason: "conflict_or_same_message",
      });
      return { task: duplicate, duplicate: true, suspended: null };
    }

    const suspended = suspendCurrentTask(state, task);
    state.tasks.push(task);
    appendAuditEvent({
      actor: "concierge",
      action: "task_queued",
      target: task.primary_intent,
      task_id: task.id,
      status: task.status,
      meta: { route: task.route, source: task.source },
    });
    activateTask(state, task);
    return { task, duplicate: false, suspended };
  });
}

function runHeartbeatCycle({ language = "it" } = {}) {
  return withState((state) => {
    refreshKnowledge(state);
    const window = workWindowStatus();
    if (!window.open) {
      appendAuditEvent({
        actor: "supervisor",
        action: "heartbeat_paused",
        target: "work_window",
        status: "paused",
        reason: "outside_work_window",
        meta: window,
      });
      return { created: [], activeTask: null, result: { event: "paused", step: "work_window", window } };
    }
    const created = enqueueHeartbeatCycle(state, language);
    let activeTask = state.tasks.find((item) => item.id === state.currentTaskId && item.status === "running");
    if (!activeTask) {
      activeTask = activateTask(state, pickNextTask(state));
    }
    const result = activeTask ? stepRunningTask(state) : null;
    return { created, activeTask, result };
  });
}

function markTaskDone(taskId, crmKeys = []) {
  return withState((state) => {
    refreshKnowledge(state);
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return { task: null };
    task.status = "done";
    touchTask(task);
    insertKnowledgeKeys(state, [...persistentKnowledgeKeys(task), ...crmKeys], "doneKeys");
    if (state.currentTaskId === taskId) state.currentTaskId = null;
    if (state.currentForegroundTaskId === taskId) state.currentForegroundTaskId = null;
    appendAuditEvent({
      actor: task.agent_role || "worker",
      action: "task_done_manual",
      target: task.primary_intent,
      task_id: task.id,
      status: task.status,
      meta: { crm_keys: crmKeys },
    });
    const suspended = sortTasks(state.tasks.filter((item) => item.status === "suspended"));
    if (suspended.length && !state.currentTaskId) activateTask(state, suspended[0]);
    return { task };
  });
}

function ingestPlannedTask(plan, context = {}) {
  return withState((state) => {
    refreshKnowledge(state);
    const task = makeTaskFromPlan(plan, context);
    if (taskMatchesKnowledge(task, state.knowledge)) {
      appendAuditEvent({
        actor: task.agent_role || "worker",
        action: "task_blocked",
        target: task.primary_intent,
        task_id: task.id,
        status: "blocked",
        reason: "known_in_crm_or_done",
      });
      return {
        task: createTask({
          ...task,
          status: "blocked",
          metadata: {
            ...task.metadata,
            blocked_reason: "known_in_crm_or_done",
          },
        }),
        duplicate: true,
        suspended: null,
      };
    }

    const duplicate = state.tasks.find((item) =>
      ["queued", "running", "suspended", "done"].includes(item.status)
      && (taskConflicts(item, task) || item.message === task.message)
    );

    if (duplicate) {
      appendAuditEvent({
        actor: task.agent_role || "worker",
        action: "task_duplicate",
        target: task.primary_intent,
        task_id: duplicate.id,
        status: duplicate.status,
        reason: "conflict_or_same_message",
      });
      return { task: duplicate, duplicate: true, suspended: null };
    }

    const suspended = suspendCurrentTask(state, task);
    state.tasks.push(task);
    appendAuditEvent({
      actor: task.agent_role || "worker",
      action: "task_queued",
      target: task.primary_intent,
      task_id: task.id,
      status: task.status,
      meta: { route: task.route, source: task.source },
    });
    activateTask(state, task);
    return { task, duplicate: false, suspended };
  });
}

module.exports = {
  ingestChatTask,
  ingestPlannedTask,
  runHeartbeatCycle,
  markTaskDone,
};
