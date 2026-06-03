"use strict";

const { ingestNewsItems } = require("../lib/news-store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const items = Array.isArray(body.items) ? body.items : [];
  const { state, added } = ingestNewsItems(items);

  return res.status(200).json({
    ok: true,
    added_count: added.length,
    added,
    total: state.items.length,
  });
};
