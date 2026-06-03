"use strict";

const { analyzeRoute, buildDirectReply } = require("../lib/progressive-router");
const { buildExecutionPlan } = require("../lib/openclaw-contract");
const { dispatchExecution } = require("../lib/execution-dispatch");
const { appendShadowEvent } = require("../lib/shadow-log");
const { runHeartbeatCycle } = require("../lib/worker-engine");

const DEFAULT_LANGUAGE = "fr";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const message = String(body.message || "").trim();
  const language = String(body.language || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
  const history = Array.isArray(body.messages) ? body.messages : [];
  const memory = String(body.memory || "").trim();

  if (!message) {
    return res.status(400).json({ ok: false, error: "Missing message" });
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

  try {
    const dispatch = await dispatchExecution(executionPlan, {
      message,
      language,
      history,
      memory,
      directReply,
    });

    appendShadowEvent({
      source: "dispatch",
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

    return res.status(200).json({
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
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Dispatch failed";
    appendShadowEvent({
      source: "dispatch",
      route: route.name,
      language,
      message,
      dispatchMode: "error",
      target: executionPlan.executor,
      modelProfile: executionPlan.model_profile,
      compressionMode: executionPlan.compression_mode,
      hasReply: false,
      error: errorMessage,
    });
    return res.status(500).json({
      ok: false,
      route: route.name,
      execution_plan: executionPlan,
      error: errorMessage,
    });
  }
};
