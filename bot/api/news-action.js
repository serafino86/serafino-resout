"use strict";

const { resolveNewsAction } = require("../lib/news-actions");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const action = String(req.query?.action || body.action || "").trim().toUpperCase();
  const result = resolveNewsAction(action);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }
  return res.status(200).json(result);
};
