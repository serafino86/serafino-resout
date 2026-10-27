"use strict";

const { DEFAULT_LANGUAGE, dispatchMessage } = require("../lib/dispatch-message");

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

  try {
    const hasAllowWorkerFlag = Object.prototype.hasOwnProperty.call(body, "allow_worker_queue");
    const hasForceExecutionFlag = Object.prototype.hasOwnProperty.call(body, "force_execution");
    const result = await dispatchMessage({
      message,
      language,
      memory,
      messages: history,
      source: body.source || "frontbot-http",
      allowWorkerQueue: hasAllowWorkerFlag ? body.allow_worker_queue === true : false,
      forceExecution: hasForceExecutionFlag ? body.force_execution === true : true,
    });
    return res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Dispatch failed";
    return res.status(500).json({
      ok: false,
      error: errorMessage,
    });
  }
};
