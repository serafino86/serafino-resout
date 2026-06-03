"use strict";

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
  if (route.name === "heartbeat" || route.name === "greeting") {
    return { target: "direct", model: null };
  }
  if (route.name === "deep_case") {
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
  const toolsAllowed = route.name === "lead_capture" || route.name === "deep_case" || route.name === "crm_status" || route.name === "ops_diagnosis";
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
      "Qualify the visitor before proposing solutions.",
      "Understand activity, main problem, desired improvement, and urgency.",
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
  }

  blocks.push("", "OUTPUT_RULES:", "Return ONLY the final reply to the user. No reasoning. No chain-of-thought. Do NOT start with 'Okay', 'Let me', 'Looking at', 'The user is asking', or any self-talk. Output the reply directly.");
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
