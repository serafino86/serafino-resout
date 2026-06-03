"use strict";

const { markTaskDone } = require("../lib/worker-engine");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const taskId = String(body.task_id || "").trim();
  const crmKeys = Array.isArray(body.crm_keys) ? body.crm_keys : [];

  if (!taskId) {
    return res.status(400).json({ ok: false, error: "Missing task_id" });
  }

  const { state, task } = markTaskDone(taskId, crmKeys);
  if (!task) {
    return res.status(404).json({ ok: false, error: "Task not found" });
  }

  return res.status(200).json({
    ok: true,
    task,
    state,
  });
};
