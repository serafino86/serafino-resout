"use strict";

const { analyzeRoute, buildDirectReply } = require("./progressive-router");
const { buildExecutionPlan } = require("./openclaw-contract");
const { dispatchExecution } = require("./execution-dispatch");
const { appendShadowEvent } = require("./shadow-log");
const { ingestPlannedTask, runHeartbeatCycle } = require("./worker-engine");
const { savePersonalMemory, buildPersonalMemoryReply, listPersonalMemoryEntries, formatPersonalMemoryList } = require("./personal-memory-store");
const { saveArticle, buildArticleReply } = require("./article-store");
const { buildNewsBriefing } = require("./news-store");
const { formatTelegramBriefing } = require("./news-filter");
const { resolveNewsAction } = require("./news-actions");
const { workWindowStatus } = require("./work-window");

const DEFAULT_LANGUAGE = "it";
const DEFAULT_CRM_URL = "https://crm.srv1587393.hstgr.cloud/news.html";

async function dispatchMessage(input = {}) {
  const message = String(input.message || "").trim();
  const language = String(input.language || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
  const history = Array.isArray(input.messages) ? input.messages : [];
  const memory = String(input.memory || "").trim();

  if (!message) {
    const error = new Error("Missing message");
    error.statusCode = 400;
    throw error;
  }

  const analysis = analyzeRoute(message, history);
  const route = analysis.route;
  const directReply = buildDirectReply(route, language, message);
  const heartbeatTick = route.name === "heartbeat" && String(process.env.WORKER_LOOP_MODE || "").trim().toLowerCase() === "on"
    ? runHeartbeatCycle({ language })
    : null;
  const executionPlan = buildExecutionPlan({
    route,
    language,
    message,
    history,
    memory,
    intents: analysis.intents,
    primaryIntent: analysis.primaryIntent,
    secondaryIntents: analysis.secondaryIntents,
  });

  if (route.name === "memory_list") {
    const entries = listPersonalMemoryEntries({ limit: 10 });
    const reply = formatPersonalMemoryList(entries, language);
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "personal-memory-store", reply, forwarded: false, entries },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "memory_forward") {
    const entries = listPersonalMemoryEntries({ limit: 10 });
    const list = formatPersonalMemoryList(entries, language);
    const reply = entries.length
      ? `${list}\n\nNon invio automaticamente a terzi da Telegram. Posso preparare il testo da mandare.`
      : list;
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "personal-memory-store", reply, forwarded: false, entries },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "personal_email") {
    const entries = listPersonalMemoryEntries({ limit: 10 });
    const list = formatPersonalMemoryList(entries, language);
    const reply = entries.length
      ? `Bozza pronta, non inviata:\n\nCiao papà,\n\n${list}\n\nTe li mando così non me li perdo.\n\nEnrico`
      : "Posso preparare una mail personale, ma non ho pensieri salvati da includere. Non invio nulla senza conferma.";
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "personal-email-draft", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "article_save") {
    const entry = saveArticle(message, { source: input.source || "http" });
    const reply = buildArticleReply(entry, language);
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "article-store", reply, forwarded: false, entry },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "news_briefing") {
    const actionMatch = message.trim().match(/^[ABCDEFGHIJ]$/i);
    const lower = message.toLowerCase().trim();
    const textActionMap = new Map([
      ["apri crm news", "A"],
      ["crm news", "A"],
      ["apri rassegna", "A"],
      ["apri la rassegna", "A"],
      ["solo modelli locali", "B"],
      ["solo opportunita business", "C"],
      ["solo opportunità business", "C"],
      ["cosa testare subito", "D"],
      ["ignora oggi", "E"],
      ["fine giornata", "F"],
      ["pensieri salvati", "G"],
      ["articoli salvati", "H"],
      ["email clienti", "I"],
      ["stato sistema", "J"],
    ]);
    if (lower === "aggiorna rassegna" || lower === "aggiorna la rassegna") {
      const reply = "La rassegna si aggiorna automaticamente ogni ora. Per leggerla ora scrivi: rassegna IA.";
      return {
        ok: true,
        route: route.name,
        intents: analysis.intents,
        primaryIntent: analysis.primaryIntent,
        secondaryIntents: analysis.secondaryIntents,
        direct_reply: reply,
        execution_plan: executionPlan,
        dispatch: { mode: "direct", target: "news-refresh-info", reply, forwarded: false },
        heartbeat_tick: null,
        reply,
      };
    }
    if (lower === "nascondi queste") {
      const actionResult = resolveNewsAction("E");
      const reply = actionResult.ok ? "Ok, le ho nascoste dalla rassegna." : "Non sono riuscito a nasconderle.";
      return {
        ok: true,
        route: route.name,
        intents: analysis.intents,
        primaryIntent: analysis.primaryIntent,
        secondaryIntents: analysis.secondaryIntents,
        direct_reply: reply,
        execution_plan: executionPlan,
        dispatch: { mode: "direct", target: "news-action", reply, forwarded: false, action: "E" },
        heartbeat_tick: null,
        reply,
      };
    }
    const textAction = textActionMap.get(lower);
    if (actionMatch || textAction) {
      const action = actionMatch ? actionMatch[0].toUpperCase() : textAction;
      const actionResult = resolveNewsAction(action);
      const reply = actionResult.ok ? actionResult.text : "Azione rassegna non riconosciuta.";
      return {
        ok: true,
        route: route.name,
        intents: analysis.intents,
        primaryIntent: analysis.primaryIntent,
        secondaryIntents: analysis.secondaryIntents,
        direct_reply: reply,
        execution_plan: executionPlan,
        dispatch: { mode: "direct", target: "news-action", reply, forwarded: false, action },
        heartbeat_tick: null,
        reply,
      };
    }

    let mode = "default";
    if (lower.includes("modelli locali") || lower.includes("local")) mode = "local_models";
    if (lower.includes("business") || lower.includes("opportun")) mode = "business";
    if (lower.includes("testare") || lower.includes("test")) mode = "test_now";
    const { briefing } = buildNewsBriefing();
    const digestText = formatTelegramBriefing(briefing, {
      mode,
      crmUrl: String(process.env.CRM_DASHBOARD_URL || DEFAULT_CRM_URL).trim(),
    });
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: digestText,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "news-briefing", reply: digestText, forwarded: false },
      heartbeat_tick: null,
      reply: digestText,
    };
  }

  if (route.name === "client_email_listen") {
    const taskResult = ingestPlannedTask({
      route: "client_email_listen",
      primary_intent: "client_email_triage",
      secondary_intents: ["readonly", "priority_list", "draft_followups"],
      model_profile: "local-fast",
    }, {
      source: input.source || "chat",
      language,
      message: "Email clienti: leggi solo, trova priorita, prepara follow-up, non inviare.",
      agent_role: "worker",
      priority: 80,
    });
    const reply = [
      "Ok. Metto in coda triage email clienti.",
      "Worker legge solo segnali disponibili.",
      "Worker cerca: risposte clienti, urgenze, follow-up.",
      "Reviewer prepara bozze.",
      "Nessuno invia senza ok.",
    ].join("\n");
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "worker_queue", target: "client-email-triage", reply, forwarded: false, task: taskResult.task, duplicate: taskResult.duplicate },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "email_campaign") {
    const reply = [
      "Non invio campagne automaticamente da Telegram.",
      "Ho preparato la logica preview nel CRM: tab Campagna.",
      "Include solo APPROVED con email e bozza.",
      "Esclude CLIENTE_ATTIVO, PRIMO_SCAMBIO, QUALIFICATO, PIANO_IN_CORSO, SENT, PERSO, COLD e segnali di risposta/follow-up.",
      `CRM: ${process.env.CRM_DASHBOARD_URL || "https://crm.srv1587393.hstgr.cloud/"}`
    ].join("\n");
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "email-campaign-guardrail", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "daily_recap") {
    const reply = "Fine giornata: guarda CRM > tab Fine giornata per lead grezzi/arricchiti, e chiedimi \"pensieri salvati\" per le note personali. Posso aggiungere un recap automatico quando vuoi.";
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "daily-recap", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "update_all") {
    const window = workWindowStatus();
    const taskResult = ingestPlannedTask({
      route: "update_all",
      primary_intent: "heartbeat",
      secondary_intents: ["news_collect", "lead_enrich", "client_email_triage", "backup_check"],
      model_profile: "local-fast",
    }, {
      source: input.source || "chat",
      language,
      message: "Aggiorna tutto: rassegna IA, CRM, lead, email clienti, backup. Solo micro-task.",
      agent_role: "supervisor",
      priority: 90,
    });
    const reply = [
      window.open ? "Ok. Aggiornamento messo in coda." : "Ok. Aggiornamento registrato, parte alle 09:00.",
      "Cose incluse: rassegna IA, CRM, lead, email clienti, backup.",
      "Niente richiesta lunga a Qwen.",
      `CRM: ${process.env.CRM_DASHBOARD_URL || DEFAULT_CRM_URL}`,
    ].join("\n");
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "worker_queue", target: "update-all", reply, forwarded: false, task: taskResult.task, duplicate: taskResult.duplicate },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "no_reply") {
    const reply = "No-reply attivato: resto in silenzio finché non arriva un comando specifico.";
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "no-reply", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "contact_save") {
    const reply = "Ho riconosciuto un contatto personale. Al momento preparo la scheda, ma non salvo ancora in rubrica esterna da Telegram senza un connettore contatti attivo.";
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "contact-save-stub", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "calendar_event") {
    const reply = "Ho riconosciuto un evento personale. Posso preparare il riepilogo, ma non creo eventi calendario da Telegram senza conferma e connettore calendario attivo.";
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "calendar-event-stub", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "crm_status") {
    const reply = [
      "CRM pronto.",
      process.env.CRM_DASHBOARD_URL || "https://crm.srv1587393.hstgr.cloud/",
      "Per i dati: tab Fine giornata, Lead, Campagna.",
    ].join("\n");
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "crm-status", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "ops_diagnosis") {
    const window = workWindowStatus();
    const reply = [
      window.open ? "Sistema attivo." : "Sistema in pausa lavoro automatico.",
      window.message,
      "Telegram resta attivo.",
      "Qwen fa solo task brevi in micro-batch.",
    ].join("\n");
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "ops-diagnosis-lite", reply, forwarded: false, work_window: window },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "lead_capture") {
    const reply = "Ricevuto. La lead-gen automatica sta già lavorando in micro-batch: 1 lead per ciclo, arricchimento progressivo e sync CRM. Apri la tab Fine giornata per vedere cosa entra.";
    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch: { mode: "direct", target: "leadgen-autopilot", reply, forwarded: false },
      heartbeat_tick: null,
      reply,
    };
  }

  if (route.name === "personal_memory") {
    const entry = savePersonalMemory(message, { source: input.source || "http" });
    const reply = buildPersonalMemoryReply(entry, language);
    const dispatch = {
      mode: "direct",
      target: "personal-memory-store",
      reply,
      forwarded: false,
      entry,
    };

    appendShadowEvent({
      source: input.logSource || "dispatch",
      route: route.name,
      language,
      message,
      dispatchMode: dispatch.mode,
      target: dispatch.target,
      modelProfile: executionPlan.model_profile,
      compressionMode: executionPlan.compression_mode,
      hasReply: true,
      error: null,
    });

    return {
      ok: true,
      route: route.name,
      intents: analysis.intents,
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      direct_reply: reply,
      execution_plan: executionPlan,
      dispatch,
      heartbeat_tick: null,
      reply,
    };
  }

  const dispatch = await dispatchExecution(executionPlan, {
    message,
    language,
    history,
    memory,
    directReply,
    source: input.source || "http",
    allowWorkerQueue: input.allowWorkerQueue,
    forceExecution: input.forceExecution,
  });

  appendShadowEvent({
    source: input.logSource || "dispatch",
    route: route.name,
    language,
    message,
    dispatchMode: dispatch.mode,
    target: dispatch.target,
    modelProfile: executionPlan.model_profile,
    compressionMode: executionPlan.compression_mode,
    hasReply: Boolean(dispatch.reply),
    error: dispatch.error || null,
  });

  return {
    ok: true,
    route: route.name,
    intents: analysis.intents,
    primaryIntent: analysis.primaryIntent,
    secondaryIntents: analysis.secondaryIntents,
    direct_reply: directReply,
    execution_plan: executionPlan,
    dispatch,
    heartbeat_tick: heartbeatTick ? {
      created_count: heartbeatTick.created.length,
      active_task_id: heartbeatTick.state.currentTaskId,
      event: heartbeatTick.result?.event || null,
    } : null,
    reply: dispatch.reply,
  };
}

module.exports = {
  DEFAULT_LANGUAGE,
  dispatchMessage,
};
