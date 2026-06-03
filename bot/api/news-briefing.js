"use strict";

const { buildNewsBriefing } = require("../lib/news-store");
const { formatTelegramBriefing } = require("../lib/news-filter");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { briefing, state } = buildNewsBriefing();
  const crmUrl = String(process.env.CRM_DASHBOARD_URL || "").trim();
  return res.status(200).json({
    ok: true,
    updated_at: state.updated_at,
    last_briefing_at: state.last_briefing_at,
    briefing,
    telegram_text: formatTelegramBriefing(briefing, { crmUrl }),
  });
};
