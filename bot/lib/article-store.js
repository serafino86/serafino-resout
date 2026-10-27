"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ARTICLE_FILE = path.join(DATA_DIR, "saved-articles.jsonl");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeSpaces(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function inferArticle(message) {
  const text = normalizeSpaces(message);
  const url = text.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/g, "") || "";
  const title = text
    .replace(/https?:\/\/\S+/ig, "")
    .replace(/\b(salva|questo|questa|un|una|articolo|link)\b/ig, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    url,
    title: title || url || text,
  };
}

function readArticles() {
  try {
    return fs.readFileSync(ARTICLE_FILE, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function saveArticle(message, options = {}) {
  ensureDataDir();
  const inferred = inferArticle(message);
  const existing = readArticles().find((entry) =>
    inferred.url
      ? String(entry.url || "") === inferred.url
      : String(entry.title || "").toLowerCase() === inferred.title.toLowerCase()
  );
  if (existing) return { ...existing, duplicate: true };

  const entry = {
    id: `article_${Date.now()}`,
    ts: new Date().toISOString(),
    source: options.source || "unknown",
    title: inferred.title,
    url: inferred.url,
    original_message: normalizeSpaces(message),
  };
  fs.appendFileSync(ARTICLE_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

function buildArticleReply(entry, language = "it") {
  const suffix = entry.url ? `\n${entry.url}` : "";
  if (language === "en") return `Saved article: ${entry.title}.${suffix}`;
  if (language === "fr") return `Article enregistré : ${entry.title}.${suffix}`;
  return `Articolo salvato: ${entry.title}.${suffix}`;
}

module.exports = {
  ARTICLE_FILE,
  readArticles,
  saveArticle,
  buildArticleReply,
};
