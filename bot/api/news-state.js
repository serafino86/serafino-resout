"use strict";

const { loadNewsState, NEWS_FILE } = require("../lib/news-store");
const { buildDailyBriefing, isBriefingCandidate } = require("../lib/news-filter");

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
    last_prepared_at: state.last_prepared_at,
    prepared_briefing: state.prepared_briefing,
    count: state.items.length,
    briefing: buildDailyBriefing(state.items),
    items: state.items.filter(isBriefingCandidate).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 50),
  });
};
