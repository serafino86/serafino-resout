"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DATA_DIR = path.resolve(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "worker-state.json");

const EMPTY_STATE = {
  tasks: [],
  currentTaskId: null,
  currentForegroundTaskId: null,
  heartbeatCursor: 0,
  cycleCount: 0,
  knowledge: {
    crmKeys: [],
    doneKeys: [],
    runningKeys: [],
    sourcePath: null,
    pipelineSource: null,
    records: 0,
  },
  news: {
    lastScanAt: null,
    count: 0,
    topTitles: [],
  },
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) return clone(EMPTY_STATE);
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      ...clone(EMPTY_STATE),
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      knowledge: {
        crmKeys: Array.isArray(parsed.knowledge?.crmKeys) ? parsed.knowledge.crmKeys : [],
        doneKeys: Array.isArray(parsed.knowledge?.doneKeys) ? parsed.knowledge.doneKeys : [],
        runningKeys: Array.isArray(parsed.knowledge?.runningKeys) ? parsed.knowledge.runningKeys : [],
        sourcePath: parsed.knowledge?.sourcePath || null,
        pipelineSource: parsed.knowledge?.pipelineSource || null,
        records: Number.isFinite(parsed.knowledge?.records) ? parsed.knowledge.records : 0,
      },
      news: {
        lastScanAt: parsed.news?.lastScanAt || null,
        count: Number.isFinite(parsed.news?.count) ? parsed.news.count : 0,
        topTitles: Array.isArray(parsed.news?.topTitles) ? parsed.news.topTitles : [],
      },
    };
  } catch (_) {
    return clone(EMPTY_STATE);
  }
}

function saveState(state) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function withState(mutator) {
  const state = loadState();
  const result = mutator(state) || {};
  saveState(state);
  return { state, ...result };
}

function nowIso() {
  return new Date().toISOString();
}

function createTask(input) {
  const ts = nowIso();
  return {
    id: crypto.randomUUID(),
    source: input.source || "system",
    route: input.route || "short_chat",
    priority: Number.isFinite(input.priority) ? input.priority : 50,
    status: input.status || "queued",
    message: String(input.message || "").trim(),
    language: input.language || "it",
    model_profile: input.model_profile || "local-fast",
    primary_intent: input.primary_intent || input.route || "task",
    secondary_intents: Array.isArray(input.secondary_intents) ? input.secondary_intents : [],
    dedupe_keys: Array.isArray(input.dedupe_keys) ? input.dedupe_keys : [],
    steps: Array.isArray(input.steps) ? input.steps : [],
    current_step: Number.isFinite(input.current_step) ? input.current_step : 0,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    created_at: ts,
    updated_at: ts,
    suspended_from: input.suspended_from || null,
    resume_after: input.resume_after || null,
  };
}

function touchTask(task) {
  task.updated_at = nowIso();
  return task;
}

function taskMatchesKnowledge(task, knowledge) {
  const allKeys = new Set([
    ...(Array.isArray(knowledge.crmKeys) ? knowledge.crmKeys : []),
    ...(Array.isArray(knowledge.doneKeys) ? knowledge.doneKeys : []),
    ...(Array.isArray(knowledge.runningKeys) ? knowledge.runningKeys : []),
  ]);
  return (task.dedupe_keys || []).some((key) => allKeys.has(key));
}

function taskConflicts(task, candidate) {
  if (!task || !candidate) return false;
  const left = new Set(task.dedupe_keys || []);
  return (candidate.dedupe_keys || []).some((key) => left.has(key));
}

function insertKnowledgeKeys(state, keys, bucket) {
  const set = new Set(state.knowledge[bucket] || []);
  for (const key of keys || []) {
    if (key) set.add(key);
  }
  state.knowledge[bucket] = [...set];
}

module.exports = {
  STATE_FILE,
  loadState,
  saveState,
  withState,
  createTask,
  touchTask,
  taskMatchesKnowledge,
  taskConflicts,
  insertKnowledgeKeys,
};
