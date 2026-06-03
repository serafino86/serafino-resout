"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { classifyNewsItem, buildDailyBriefing } = require("./news-filter");

const DATA_DIR = path.resolve(__dirname, "..", "data");
const NEWS_FILE = path.join(DATA_DIR, "news-state.json");

const EMPTY_NEWS = {
  raw_items: [],
  filtered_items: [],
  items: [],
  briefing: null,
  last_collection_at: null,
  updated_at: null,
  last_briefing_at: null,
};

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

  state.raw_items = [...rawAdded, ...state.raw_items].slice(0, 400);
  state.filtered_items = state.items.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 200);
  state.last_collection_at = new Date().toISOString();
  state.updated_at = new Date().toISOString();
  saveNewsState(state);
  return { state, added };
}

function buildNewsBriefing() {
  const state = loadNewsState();
  const briefing = buildDailyBriefing(state.items);
  state.briefing = briefing;
  state.last_briefing_at = new Date().toISOString();
  saveNewsState(state);
  return {
    state,
    briefing,
  };
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

  state.filtered_items = state.items.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 200);
  state.updated_at = new Date().toISOString();
  saveNewsState(state);
  return { state, updated };
}

function markTopNews(status, limit = 3) {
  const state = loadNewsState();
  const topIds = state.items
    .filter((item) => !item.noisy)
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
  updateNewsStatus,
  markTopNews,
};
