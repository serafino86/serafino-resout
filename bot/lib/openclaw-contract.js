"use strict";

const { buildNewsBriefing } = require("./news-store");

function trimHistory(history, limit) {
  const normalized = Array.isArray(history) ? history : [];
  return normalized.slice(-Math.max(0, limit || 0)).map((entry) => ({
    role: entry && entry.role === "assistant" ? "assistant" : "user",
    text: String((entry && (entry.text || entry.content)) || "").trim(),
  })).filter((entry) => entry.text);
}

function summarizeHistory(history) {
  const items = trimHistory(history, 4);
  if (!items.length) return "- none";
  return items.map((item) => `${item.role}: ${item.text}`).join("\n");
}

function chooseExecutor(route) {
  if ([
    "heartbeat",
    "greeting",
    "memory_list",
    "memory_forward",
    "article_save",
    "news_briefing",
    "email_campaign",
    "client_email_listen",
    "daily_recap",
    "no_reply",
  ].includes(route.name)) {
    return { target: "direct", model: null };
  }
  if (route.name === "deep_case" || route.name === "news_prepare") {
    return { target: "openclaw", model: "nemotron" };
  }
  return { target: "openclaw", model: "local-fast" };
}

function buildOpenClawPrompt(params) {
  const {
    route,
    language,
    message,
    memory,
    history,
    intents = [],
    primaryIntent,
    secondaryIntents = [],
  } = params;
  const executor = chooseExecutor(route);
  const toolsAllowed = [
    "lead_capture",
    "deep_case",
    "crm_status",
    "ops_diagnosis",
    "personal_memory",
    "personal_email",
    "calendar_event",
    "contact_save",
    "news_prepare",
  ].includes(route.name);
  const personalRoutes = new Set(["personal_memory", "personal_email", "calendar_event", "contact_save"]);
  const blocks = [
    `ROUTE: ${route.name}`,
    `PRIMARY_INTENT: ${primaryIntent || intents[0] || route.name}`,
    `SECONDARY_INTENTS: ${secondaryIntents.length ? secondaryIntents.join(", ") : "none"}`,
    `EXECUTOR: ${executor.target}`,
    `MODEL_PROFILE: ${executor.model || "none"}`,
    `LANGUAGE: ${language}`,
    `COMPRESSION_MODE: ${route.compressionMode}`,
    `USE_MEMORY: ${route.useMemory ? "yes" : "no"}`,
    `TOOLS_ALLOWED: ${toolsAllowed ? "yes" : "no"}`,
    `KB_FILES: ${route.kbFiles.length ? route.kbFiles.join(", ") : "none"}`,
    personalRoutes.has(route.name) ? "DOMAIN: personal" : "DOMAIN: business_or_general",
    personalRoutes.has(route.name) ? "CRM_ALLOWED: no" : "CRM_ALLOWED: yes_when_relevant",
    personalRoutes.has(route.name) ? "BUSINESS_EMAIL_ALLOWED: no" : "BUSINESS_EMAIL_ALLOWED: yes_when_relevant",
    route.name === "personal_email" ? "PERSONAL_EMAIL_ALLOWED: draft_only_until_confirmation" : "PERSONAL_EMAIL_ALLOWED: no_unless_route_requires_it",
    route.name === "calendar_event" ? "CALENDAR_ALLOWED: prepare_or_create_only_after_confirmation" : "CALENDAR_ALLOWED: no_unless_route_requires_it",
    "CONFIRMATION_REQUIRED_FOR_EXTERNAL_ACTIONS: yes",
    "",
    "USER_MESSAGE:",
    message || "",
    "",
    "MEMORY:",
    route.useMemory ? (String(memory || "").trim() || "- none") : "- disabled",
    "",
    "RECENT_HISTORY:",
    summarizeHistory(history),
    "",
  ];

  if (route.name === "short_chat") {
    blocks.push(
      "TASK:",
      "Answer briefly and naturally.",
      "Do not use tools.",
      "Do not read extra memory.",
      "Ask at most one short follow-up question."
    );
  } else if (route.name === "personal_memory") {
    blocks.push(
      "TASK:",
      "OpenClaw must handle this as personal memory for Enrico.",
      "Do not write to business CRM or lead pipeline.",
      "If enough information is present, prepare the exact memory note and ask for confirmation before saving.",
      "If information is missing, ask one short question."
    );
  } else if (route.name === "personal_email") {
    blocks.push(
      "TASK:",
      "OpenClaw must handle this as a personal email request.",
      "Use personal Gmail context/tools only, never the business account.",
      "Draft the email if enough information is present.",
      "Do not invent memories, events, relationships, names, or facts that are not in the user message or available context.",
      "If no personal details are provided, write a generic affectionate draft without specific shared events or claims.",
      "If the user asks to send, still show a concise draft first and ask explicit confirmation.",
      "Do not send without explicit confirmation from Enrico after showing the draft."
    );
  } else if (route.name === "calendar_event") {
    blocks.push(
      "TASK:",
      "OpenClaw must handle this as a calendar request.",
      "Use the existing calendar tools/scripts if available.",
      "If title, date, and time are clear, prepare the event summary.",
      "Do not create the event without explicit confirmation from Enrico."
    );
  } else if (route.name === "contact_save") {
    blocks.push(
      "TASK:",
      "OpenClaw must handle this as a personal contact request.",
      "Keep it outside business CRM and lead records.",
      "Extract name, phone, email, and context if present.",
      "Do not save externally without explicit confirmation from Enrico."
    );
  } else if (route.name === "crm_status") {
    blocks.push(
      "TASK:",
      "Answer a CRM or pipeline status request.",
      "Prefer exact counts, current state, and what needs attention next.",
      "If tools are available, use them to inspect status instead of guessing."
    );
  } else if (route.name === "ops_diagnosis") {
    blocks.push(
      "TASK:",
      "Run an operational diagnosis.",
      "Check what is blocked, degraded, or pending.",
      "Prefer status and next action over explanation.",
      "Use tools only for concrete checks."
    );
  } else if (route.name === "lead_capture") {
    blocks.push(
      "TASK:",
      "Handle a lead or lead-research request.",
      "If the user asks to search, find, enrich, scan, or update leads, treat it as an operational command, not as a visitor qualification chat.",
      "Check existing CRM/pipeline state first and do not duplicate leads already known or marked done.",
      "Use the exec tool when available. Known workspace commands:",
      "- Search/new-lead cycle: bash /data/.openclaw/workspace/scripts/node-pipeline-trigger.sh",
      "- Enrich one pending lead: bash /data/.openclaw/workspace/scripts/run-enrich-task.sh",
      "- Full idle router: bash /data/.openclaw/workspace/scripts/router.sh",
      "If execution cannot be completed in this turn, return the precise next operational step and what is blocked.",
      "Keep the answer compact and concrete.",
      "Use tools only if they are truly needed.",
      secondaryIntents.length ? `Keep track of deferred sub-intents: ${secondaryIntents.join(", ")}.` : "No deferred sub-intents."
    );
  } else if (route.name === "deep_case") {
    blocks.push(
      "TASK:",
      "Handle a detailed or high-friction business request.",
      "Prefer honesty and compression over long explanations.",
      "Use only the listed KB files and the provided memory/history.",
      "If the task becomes execution-heavy, respond with the next precise action."
    );
  } else if (route.name === "news_prepare") {
    const { briefing } = buildNewsBriefing();
    const top = Array.isArray(briefing?.summary?.top) ? briefing.summary.top.slice(0, 8) : [];
    blocks.push(
      "NEWS_ITEMS:",
      top.length
        ? top.map((item, index) => [
          `${index + 1}. ${item.title}`,
          `SOURCE: ${item.source || "unknown"}`,
          `URL: ${item.url || "none"}`,
          `SNIPPET: ${String(item.snippet || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400)}`,
          `CATEGORIES: ${(item.categories || []).join(", ") || "none"}`,
        ].join("\n")).join("\n\n")
        : "- none",
      "",
      "TASK:",
      "Compress the collected news into an Italian summary.",
      "Do not reason freely.",
      "Do not decide strategy.",
      "Do not use tools.",
      "Prepare:",
      "1. The 3 clearest news items.",
      "2. A short factual summary for each.",
      "3. A short note if an item looks weak or low-signal.",
      "Do not invent facts beyond NEWS_ITEMS.",
      "Do not send emails or modify CRM.",
      "Return Italian only."
    );
  }

  blocks.push(
    "",
    "OUTPUT_RULES:",
    "Return only the final user-facing answer.",
    "Keep Telegram replies compact: maximum 5 short lines unless showing a draft.",
    "No hidden reasoning, tool JSON, bash transcript, or fabricated facts."
  );
  return blocks.join("\n");
}

function buildExecutionPlan(params) {
  const { route, intents = [], primaryIntent, secondaryIntents = [] } = params;
  const executor = chooseExecutor(route);
  const prompt = buildOpenClawPrompt(params);

  return {
    route: route.name,
    intents,
    primary_intent: primaryIntent || intents[0] || route.name,
    secondary_intents: secondaryIntents,
    executor: executor.target,
    model_profile: executor.model,
    compression_mode: route.compressionMode,
    kb_files: route.kbFiles,
    use_memory: route.useMemory,
    history_limit: route.historyLimit,
    max_tokens: route.maxTokens,
    openclaw_prompt: prompt,
  };
}

module.exports = {
  buildExecutionPlan,
};
