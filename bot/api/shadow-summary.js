"use strict";

const { summarizeShadowEvents } = require("../lib/shadow-log");
const { DEFAULT_POLICIES } = require("../lib/route-policy");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const limit = Math.max(1, Math.min(1000, Number(req.query?.limit || req.query?.n || 200)));
  return res.status(200).json({
    ok: true,
    policies: DEFAULT_POLICIES,
    summary: summarizeShadowEvents(limit),
  });
};
