"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "personal-memory.jsonl");

function nowIso() {
  return new Date().toISOString();
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeSpaces(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function stripTrailingPunctuation(text) {
  return normalizeSpaces(text).replace(/[.!?;:]+$/g, "").trim();
}

function titleCaseKnown(title) {
  const raw = stripTrailingPunctuation(title);
  if (!raw) return raw;
  return raw.split(" ").map((part) => {
    if (!part) return part;
    if (part.length <= 3 && part === part.toUpperCase()) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

function inferPersonalMemory(message) {
  const original = normalizeSpaces(message);
  const lower = original.toLowerCase();
  const isWatch =
    /\b(serie|film|documentario|anime|show)\b/i.test(original)
    || /\b(da guardare|da vedere|watchlist)\b/i.test(original);

  let title = "";
  const commaMatch = original.match(/^(.+?),\s*(ricordami|ricordati|segnati|annota)\b/i);
  if (commaMatch) {
    title = commaMatch[1];
  }

  if (!title) {
    const afterMatch = original.match(/\b(?:ricordami|ricordati|mi ricordi|segnati|annota|salva)\b(?:\s+di|\s+che|\s+questa|\s+questo)?\s+(.+)$/i);
    if (afterMatch) title = afterMatch[1];
  }

  title = stripTrailingPunctuation(title)
    .replace(/\b(questa|questo)\s+(serie|film|documentario|anime|show)\b/ig, "")
    .replace(/\b(da guardare|da vedere|in watchlist)\b/ig, "")
    .trim();

  const type = isWatch ? "watchlist" : "note";
  const label = type === "watchlist" && title ? titleCaseKnown(title) : (title || original);
  const note = type === "watchlist"
    ? `${label} — da guardare`
    : label;

  return {
    type,
    title: label,
    note,
  };
}

function readPersonalMemoryEntries() {
  try {
    return fs.readFileSync(MEMORY_FILE, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function listPersonalMemoryEntries(options = {}) {
  const entries = readPersonalMemoryEntries().sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
  const type = String(options.type || "").trim();
  const limit = Math.max(1, Math.min(50, Number(options.limit || 10)));
  return entries
    .filter((entry) => !type || entry.type === type)
    .slice(0, limit);
}

function savePersonalMemory(message, options = {}) {
  ensureDataDir();
  const inferred = inferPersonalMemory(message);
  const existing = readPersonalMemoryEntries().find((entry) =>
    String(entry.type || "") === inferred.type
    && String(entry.note || "").toLowerCase() === inferred.note.toLowerCase()
  );
  if (existing) return { ...existing, duplicate: true };

  const entry = {
    id: `pm_${Date.now()}`,
    ts: nowIso(),
    source: options.source || "unknown",
    type: inferred.type,
    title: inferred.title,
    note: inferred.note,
    original_message: normalizeSpaces(message),
  };
  fs.appendFileSync(MEMORY_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

function formatPersonalMemoryList(entries, language = "it") {
  if (!entries.length) {
    if (language === "en") return "No saved thoughts found.";
    if (language === "fr") return "Aucune note personnelle trouvée.";
    return "Non trovo pensieri salvati.";
  }
  const lines = entries.map((entry, index) => `${index + 1}. ${entry.note}`);
  if (language === "en") return ["Saved thoughts:", ...lines].join("\n");
  if (language === "fr") return ["Notes enregistrées :", ...lines].join("\n");
  return ["Pensieri salvati:", ...lines].join("\n");
}

function buildPersonalMemoryReply(entry, language = "it") {
  if (language === "en") return `Saved: ${entry.note}.`;
  if (language === "fr") return `Note prise : ${entry.note}.`;
  if (language === "de-CH") return `Gspeicheret: ${entry.note}.`;
  return `Segnato: ${entry.note}.`;
}

module.exports = {
  MEMORY_FILE,
  inferPersonalMemory,
  readPersonalMemoryEntries,
  listPersonalMemoryEntries,
  savePersonalMemory,
  formatPersonalMemoryList,
  buildPersonalMemoryReply,
};
