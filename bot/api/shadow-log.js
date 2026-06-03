"use strict";

const { readShadowEvents, LOG_FILE } = require("../lib/shadow-log");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const limit = Math.max(1, Math.min(200, Number(req.query?.limit || req.query?.n || 50)));
  return res.status(200).json({
    ok: true,
    log_file: LOG_FILE,
    events: readShadowEvents(limit),
  });
};
