"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { classifyNewsItem, buildDailyBriefing, isBriefingCandidate } = require("./news-filter");

const DATA_DIR = path.resolve(__dirname, "..", "data");
const NEWS_FILE = path.join(DATA_DIR, "news-state.json");

const EMPTY_NEWS = {
  raw_items: [],
  filtered_items: [],
  items: [],
  briefing: null,
  prepared_briefing: null,
  last_collection_at: null,
  updated_at: null,
  last_briefing_at: null,
  last_prepared_at: null,
};

const MAX_NEWS_ITEMS = 180;
const MAX_RAW_ITEMS = 220;
const MAX_FILTERED_ITEMS = 80;
const MAX_NEWS_AGE_DAYS = 14;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadNewsState() {
  ensureDir();
  if (!fs.existsSync(NEWS_FILE)) return { ...EMPTY_NEWS };
  try {
    const parsed = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
    return {
      ...EMPTY_NEWS,
      ...parsed,
      raw_items: Array.isArray(parsed.raw_items) ? parsed.raw_items : [],
      filtered_items: Array.isArray(parsed.filtered_items) ? parsed.filtered_items : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      prepared_briefing: parsed.prepared_briefing && typeof parsed.prepared_briefing === "object" ? parsed.prepared_briefing : null,
    };
  } catch (_) {
    return { ...EMPTY_NEWS };
  }
}

function saveNewsState(state) {
  ensureDir();
  fs.writeFileSync(NEWS_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function canonicalKey(raw) {
  const title = String(raw.title || "").trim().toLowerCase();
  const url = String(raw.url || "").trim().toLowerCase();
  return `${title}::${url}`;
}

function isWithinNewsWindow(item) {
  const published = Date.parse(item?.published_at || "");
  if (!Number.isFinite(published)) return true;
  return Date.now() - published <= MAX_NEWS_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function pruneNewsItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(isWithinNewsWindow)
    .sort((a, b) => {
      const bTime = Date.parse(b.published_at || "") || 0;
      const aTime = Date.parse(a.published_at || "") || 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, MAX_NEWS_ITEMS);
}

function ingestNewsItems(rawItems) {
  const state = loadNewsState();
  const existing = new Set(state.items.map((item) => canonicalKey(item)));
  const added = [];
  const rawAdded = [];

  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const key = canonicalKey(raw);
    if (!raw?.title || existing.has(key)) continue;
    rawAdded.push(raw);
    const item = classifyNewsItem({
      ...raw,
      id: raw.id || crypto.randomUUID(),
    });
    state.items.push(item);
    existing.add(key);
    added.push(item);
  }

  state.items = pruneNewsItems(state.items);
  state.raw_items = [...rawAdded, ...state.raw_items].filter(isWithinNewsWindow).slice(0, MAX_RAW_ITEMS);
  state.filtered_items = state.items.filter(isBriefingCandidate).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, MAX_FILTERED_ITEMS);
  state.last_collection_at = new Date().toISOString();
  state.updated_at = new Date().toISOString();
  saveNewsState(state);
  return { state, added };
}

function buildNewsBriefing() {
  const state = loadNewsState();
  state.items = state.items.map((item) => classifyNewsItem(item));
  state.items = pruneNewsItems(state.items);
  state.filtered_items = state.items.filter(isBriefingCandidate).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, MAX_FILTERED_ITEMS);
  const briefing = buildDailyBriefing(state.items);
  briefing.prepared = state.prepared_briefing || null;
  state.briefing = briefing;
  state.last_briefing_at = new Date().toISOString();
  saveNewsState(state);
  return {
    state,
    briefing,
  };
}

function savePreparedBriefing(prepared) {
  const state = loadNewsState();
  state.prepared_briefing = {
    text: String(prepared?.text || "").trim(),
    provider: prepared?.provider || null,
    model: prepared?.model || null,
    source_item_ids: Array.isArray(prepared?.source_item_ids) ? prepared.source_item_ids : [],
    created_at: new Date().toISOString(),
  };
  state.last_prepared_at = state.prepared_briefing.created_at;
  state.updated_at = new Date().toISOString();
  saveNewsState(state);
  return { state, prepared: state.prepared_briefing };
}

function updateNewsStatus(ids, status) {
  const state = loadNewsState();
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  let updated = 0;

  state.items = state.items.map((item) => {
    if (!idSet.has(item.id)) return item;
    updated += 1;
    return {
      ...item,
      status,
    };
  });

  state.filtered_items = state.items.filter(isBriefingCandidate).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 200);
  state.updated_at = new Date().toISOString();
  saveNewsState(state);
  return { state, updated };
}

function markTopNews(status, limit = 3) {
  const state = loadNewsState();
  const topIds = state.items
    .filter(isBriefingCandidate)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, Math.max(1, limit))
    .map((item) => item.id);

  return updateNewsStatus(topIds, status);
}

module.exports = {
  NEWS_FILE,
  loadNewsState,
  saveNewsState,
  ingestNewsItems,
  buildNewsBriefing,
  savePreparedBriefing,
  updateNewsStatus,
  markTopNews,
};
