"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCES_PATH = path.resolve(__dirname, "..", "config", "news-sources.json");

function loadSources() {
  const parsed = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
  return Array.isArray(parsed) ? parsed.filter((item) => !item.disabled) : [];
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripTags(text) {
  return decodeEntities(String(text || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function matchTag(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(regex);
  return match ? stripTags(match[1]) : "";
}

function matchAttr(block, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}=["']([^"']+)["'][^>]*\\/?>`, "i");
  const match = block.match(regex);
  return match ? decodeEntities(match[1]) : "";
}

function parseRss(xml, source) {
  const blocks = String(xml || "").match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => ({
    title: matchTag(block, "title"),
    snippet: matchTag(block, "description"),
    url: matchTag(block, "link"),
    source: source.label,
    source_id: source.id,
    published_at: matchTag(block, "pubDate") || null,
    source_group: source.group,
  })).filter((item) => item.title && item.url);
}

function parseAtom(xml, source) {
  const blocks = String(xml || "").match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => ({
    title: matchTag(block, "title"),
    snippet: matchTag(block, "summary") || matchTag(block, "content"),
    url: matchAttr(block, "link", "href"),
    source: source.label,
    source_id: source.id,
    published_at: matchTag(block, "updated") || matchTag(block, "published") || null,
    source_group: source.group,
  })).filter((item) => item.title && item.url);
}

function parseFeed(body, source) {
  const text = String(body || "");
  if (/<rss[\s>]/i.test(text) || /<channel[\s>]/i.test(text)) return parseRss(text, source);
  if (/<feed[\s>]/i.test(text)) return parseAtom(text, source);
  return [];
}

async function fetchSource(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: {
      "User-Agent": "SerafinoNewsCollector/1.0",
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.5",
    },
  });

  if (!response.ok) {
    throw new Error(`${source.id}: HTTP ${response.status}`);
  }

  const body = await response.text();
  const rawItems = parseFeed(body, source);
  return {
    source,
    fetched_at: new Date().toISOString(),
    count: rawItems.length,
    raw_items: rawItems,
  };
}

async function collectNews({ limit = 15, fetchImpl = fetch } = {}) {
  const sources = loadSources().slice(0, Math.max(1, limit));
  const batches = [];
  const errors = [];

  for (const source of sources) {
    try {
      batches.push(await fetchSource(source, fetchImpl));
    } catch (error) {
      errors.push({
        source_id: source.id,
        source: source.label,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    collected_at: new Date().toISOString(),
    sources: sources.map((source) => ({ id: source.id, label: source.label, group: source.group })),
    batches,
    items: batches.flatMap((batch) => batch.raw_items),
    errors,
  };
}

module.exports = {
  SOURCES_PATH,
  loadSources,
  collectNews,
  parseFeed,
};
