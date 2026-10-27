"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DATA_DIR = path.resolve(__dirname, "..", "data");
const AUDIT_FILE = path.join(DATA_DIR, "audit-log.jsonl");
const MAX_READ_BYTES = 512 * 1024;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function appendAuditEvent(input = {}) {
  ensureDataDir();
  const event = {
    id: crypto.randomUUID(),
    at: nowIso(),
    actor: String(input.actor || "system"),
    action: String(input.action || "event"),
    target: input.target || null,
    task_id: input.task_id || null,
    status: input.status || null,
    reason: input.reason || null,
    meta: input.meta && typeof input.meta === "object" ? input.meta : {},
  };
  fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

function readRecentAuditEvents(limit = 100) {
  ensureDataDir();
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const stat = fs.statSync(AUDIT_FILE);
  const start = Math.max(0, stat.size - MAX_READ_BYTES);
  const fd = fs.openSync(AUDIT_FILE, "r");
  try {
    const buffer = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer
      .toString("utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(500, Number(limit) || 100)))
      .reverse();
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  AUDIT_FILE,
  appendAuditEvent,
  readRecentAuditEvents,
};
