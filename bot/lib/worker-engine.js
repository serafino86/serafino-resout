"use strict";

const { analyzeRoute } = require("./progressive-router");
const { loadCrmKnowledge } = require("./crm-knowledge");
const { loadNewsState } = require("./news-store");
const { buildDailyBriefing } = require("./news-filter");
const {
  withState,
  createTask,
  touchTask,
  taskMatchesKnowledge,
  taskConflicts,
  insertKnowledgeKeys,
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
    steps: ["collect_targets", "dedupe_against_crm", "search_new_leads"],
  },
  {
    route: "lead_capture",
    primary_intent: "lead_enrich",
    priority: 35,
    dedupe_keys: ["cycle:lead_enrich"],
    steps: ["pick_unenriched_leads", "dedupe_against_done", "enrich_contacts"],
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
];

function rankTask(task) {
  const sourceBoost = task.source === "chat" ? 1000 : 0;
  const suspendedBoost = task.status === "suspended" ? 100 : 0;
  return sourceBoost + suspendedBoost - (task.priority || 0);
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
      "hertbreth", "arricchisci", "arricchire", "crea", "caldo", "aggiorna", "crm",
    ].includes(token));

  if (!tokens.length) return null;
  return `target:${[...new Set(tokens)].sort().join(" ")}`;
}

function buildDedupeKeys(message, analysis) {
  const keys = new Set();
  if (analysis.primaryIntent) keys.add(`intent:${analysis.primaryIntent}`);
  for (const intent of analysis.secondaryIntents || []) keys.add(`intent:${intent}`);
  if (analysis.route.name === "lead_capture") {
    const targetKey = canonicalTargetKey(message);
    if (targetKey) keys.add(targetKey);
  }
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
    steps: ["interpret", "execute", "finalize"],
    metadata: {
      plan,
    },
  });
}

function enqueueHeartbeatCycle(state, language = "it") {
  const created = [];
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
    });
    const duplicate = state.tasks.find((item) =>
      ["queued", "running", "suspended"].includes(item.status) && taskConflicts(item, task)
    );
    if (duplicate || taskMatchesKnowledge(task, state.knowledge)) continue;
    state.tasks.push(task);
    created.push(task);
  }
  state.cycleCount += 1;
  return created;
}

function suspendCurrentTask(state, reasonTaskId) {
  if (!state.currentTaskId) return null;
  const task = state.tasks.find((item) => item.id === state.currentTaskId);
  if (!task || task.status !== "running" || task.source === "chat") return null;
  task.status = "suspended";
  task.resume_after = reasonTaskId;
  touchTask(task);
  state.currentTaskId = null;
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
  return task;
}

function stepRunningTask(state, options = {}) {
  const task = state.tasks.find((item) => item.id === state.currentTaskId);
  if (!task || task.status !== "running") return null;
  const totalSteps = Math.max(1, task.steps.length || 1);
  const currentStepName = task.steps[Math.min(task.current_step, totalSteps - 1)] || "work";
  const completed = task.current_step >= totalSteps - 1 || options.forceComplete;

  if (completed) {
    task.status = "done";
    task.current_step = totalSteps;
    touchTask(task);
    insertKnowledgeKeys(state, task.dedupe_keys, "doneKeys");
    state.currentTaskId = null;
    if (state.currentForegroundTaskId === task.id) state.currentForegroundTaskId = null;

    const suspended = sortTasks(state.tasks.filter((item) => item.status === "suspended"));
    if (suspended.length) {
      activateTask(state, suspended[0]);
    }

    return {
      task,
      event: "completed",
      step: currentStepName,
    };
  }

  task.current_step += 1;
  touchTask(task);
  return {
    task,
    event: "progressed",
    step: currentStepName,
  };
}

function ingestChatTask({ message, language = "it", analysis }) {
  return withState((state) => {
    refreshKnowledge(state);
    const task = makeTaskFromChat({ message, language, analysis });
    if (taskMatchesKnowledge(task, state.knowledge)) {
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
      return { task: duplicate, duplicate: true, suspended: null };
    }

    const suspended = suspendCurrentTask(state, task.id);
    state.tasks.push(task);
    activateTask(state, task);
    return { task, duplicate: false, suspended };
  });
}

function runHeartbeatCycle({ language = "it" } = {}) {
  return withState((state) => {
    refreshKnowledge(state);
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
    insertKnowledgeKeys(state, [...(task.dedupe_keys || []), ...crmKeys], "doneKeys");
    if (state.currentTaskId === taskId) state.currentTaskId = null;
    if (state.currentForegroundTaskId === taskId) state.currentForegroundTaskId = null;
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
      return { task: duplicate, duplicate: true, suspended: null };
    }

    const suspended = suspendCurrentTask(state, task.id);
    state.tasks.push(task);
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
