"use strict";

const fs = require("node:fs");
const path = require("node:path");

const LOG_DIR = path.resolve(__dirname, "..", "data");
const LOG_FILE = path.join(LOG_DIR, "shadow-log.jsonl");

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendShadowEvent(event) {
  ensureLogDir();
  const record = {
    ts: new Date().toISOString(),
    ...event,
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n", "utf8");
}

function readShadowEvents(limit = 50) {
  ensureLogDir();
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
  return lines.slice(-Math.max(1, limit)).map((line) => {
    try {
      return JSON.parse(line);
    } catch (_) {
      return { ts: new Date().toISOString(), type: "parse_error", raw: line };
    }
  });
}

function summarizeShadowEvents(limit = 200) {
  const events = readShadowEvents(limit);
  const byRoute = {};
  const byMode = {};

  for (const event of events) {
    byRoute[event.route] = (byRoute[event.route] || 0) + 1;
    byMode[event.dispatchMode] = (byMode[event.dispatchMode] || 0) + 1;
  }

  return {
    total: events.length,
    byRoute,
    byMode,
    lastEvent: events[events.length - 1] || null,
  };
}

module.exports = {
  LOG_FILE,
  appendShadowEvent,
  readShadowEvents,
  summarizeShadowEvents,
};
