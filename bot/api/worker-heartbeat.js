"use strict";

const { runHeartbeatCycle } = require("../lib/worker-engine");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const language = String(body.language || "it").trim() || "it";
  const { state, created, activeTask, result } = runHeartbeatCycle({ language });

  return res.status(200).json({
    ok: true,
    created_count: created.length,
    created,
    active_task: activeTask,
    tick_result: result,
    state,
  });
};
