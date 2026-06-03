"use strict";

const { loadNewsState, NEWS_FILE } = require("../lib/news-store");
const { buildDailyBriefing } = require("../lib/news-filter");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const state = loadNewsState();
  return res.status(200).json({
    ok: true,
    news_file: NEWS_FILE,
    raw_count: state.raw_items.length,
    filtered_count: state.filtered_items.length,
    updated_at: state.updated_at,
    count: state.items.length,
    briefing: buildDailyBriefing(state.items),
    items: state.items.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20),
  });
};
