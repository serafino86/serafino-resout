"use strict";

const { buildNewsBriefing } = require("../lib/news-store");
const { formatTelegramBriefing } = require("../lib/news-filter");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const mode = String(req.query?.mode || "default").trim();
  const crmUrl = String(process.env.CRM_DASHBOARD_URL || "").trim();
  const { briefing, state } = buildNewsBriefing();

  return res.status(200).json({
    ok: true,
    mode,
    updated_at: state.updated_at,
    last_briefing_at: state.last_briefing_at,
    text: formatTelegramBriefing(briefing, { mode, crmUrl }),
  });
};
