"use strict";

const { analyzeRoute } = require("../lib/progressive-router");
const { ingestChatTask } = require("../lib/worker-engine");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const message = String(body.message || "").trim();
  const language = String(body.language || "it").trim() || "it";
  const history = Array.isArray(body.messages) ? body.messages : [];

  if (!message) {
    return res.status(400).json({ ok: false, error: "Missing message" });
  }

  const analysis = analyzeRoute(message, history);
  const { state, task, duplicate, suspended } = ingestChatTask({ message, language, analysis });

  return res.status(200).json({
    ok: true,
    duplicate,
    task,
    suspended_task: suspended,
    state,
  });
};
