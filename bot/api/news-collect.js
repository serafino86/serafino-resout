"use strict";

const { collectNews } = require("../lib/news-collector");
const { ingestNewsItems, buildNewsBriefing } = require("../lib/news-store");
const { formatTelegramBriefing } = require("../lib/news-filter");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const collection = await collectNews();
    const { state, added } = ingestNewsItems(collection.items);
    const { briefing } = buildNewsBriefing();
    const crmUrl = String(process.env.CRM_DASHBOARD_URL || "").trim();
    return res.status(200).json({
      ok: true,
      collected_at: collection.collected_at,
      source_count: collection.sources.length,
      item_count: collection.items.length,
      added_count: added.length,
      errors: collection.errors,
      briefing,
      telegram_text: formatTelegramBriefing(briefing, { crmUrl }),
      state_updated_at: state.updated_at,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Collection failed",
    });
  }
};
