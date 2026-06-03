"use strict";

const { analyzeRoute, buildDirectReply } = require("../lib/progressive-router");
const { buildExecutionPlan } = require("../lib/openclaw-contract");

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

  const analysis = analyzeRoute(message, history);
  const route = analysis.route;
  const directReply = buildDirectReply(route, language, message);
  const executionPlan = buildExecutionPlan({
    route,
    language,
    message,
    history,
    memory,
    intents: analysis.intents,
    secondaryIntents: analysis.secondaryIntents,
  });

  return res.status(200).json({
    ok: true,
    route: route.name,
    intents: analysis.intents,
    secondaryIntents: analysis.secondaryIntents,
    direct_reply: directReply,
    execution_plan: executionPlan,
  });
};
