"use strict";

const { buildNewsBriefing, markTopNews } = require("./news-store");
const { formatTelegramBriefing } = require("./news-filter");
const { listPersonalMemoryEntries, formatPersonalMemoryList } = require("./personal-memory-store");
const { readArticles } = require("./article-store");

const DEFAULT_CRM_URL = "https://crm.srv1587393.hstgr.cloud/news.html";

const ACTION_MAP = {
  A: "open_crm",
  B: "local_models",
  C: "business",
  D: "test_now",
  E: "ignore_today",
  F: "daily_review",
  G: "thoughts",
  H: "articles",
  I: "client_email",
  J: "system_status",
};

function resolveNewsAction(action, options = {}) {
  const normalizedAction = String(action || "").trim().toUpperCase();
  const resolved = ACTION_MAP[normalizedAction];
  const crmUrl = String(options.crmUrl || process.env.CRM_DASHBOARD_URL || DEFAULT_CRM_URL).trim();
  const { briefing } = buildNewsBriefing();

  if (!resolved) {
    return {
      ok: false,
      action: normalizedAction,
      error: "Unknown action",
    };
  }

  if (resolved === "open_crm") {
    return {
      ok: true,
      action: normalizedAction,
      mode: resolved,
      text: crmUrl
        ? `Apri il CRM qui: ${crmUrl}`
        : "CRM_DASHBOARD_URL non configurato.",
      url: crmUrl || null,
    };
  }

  if (resolved === "ignore_today") {
    const { updated } = markTopNews("ignored", 3);
    return {
      ok: true,
      action: normalizedAction,
      mode: resolved,
      text: `Ho marcato ${updated} notizie top come ignorate per oggi.`,
      updated,
    };
  }

  if (resolved === "daily_review") {
    return {
      ok: true,
      action: normalizedAction,
      mode: resolved,
      text: [
        "Fine giornata:",
        crmUrl ? `CRM: ${crmUrl}` : "CRM_DASHBOARD_URL non configurato.",
        "Apri la tab Fine giornata per vedere lead grezzi, arricchiti, salvati e prossimo sync.",
      ].join("\n"),
    };
  }

  if (resolved === "thoughts") {
    const entries = listPersonalMemoryEntries({ limit: 10 });
    return {
      ok: true,
      action: normalizedAction,
      mode: resolved,
      text: formatPersonalMemoryList(entries, "it"),
    };
  }

  if (resolved === "articles") {
    const articles = readArticles().slice(-10).reverse();
    const lines = articles.length
      ? ["Articoli salvati:", ...articles.map((item, index) => `${index + 1}. ${item.title}${item.url ? `\n   ${item.url}` : ""}`)]
      : ["Non trovo articoli salvati."];
    return {
      ok: true,
      action: normalizedAction,
      mode: resolved,
      text: lines.join("\n"),
    };
  }

  if (resolved === "client_email") {
    return {
      ok: true,
      action: normalizedAction,
      mode: resolved,
      text: "Email clienti: mailbox/label non ancora collegata al bot Telegram. Quando la colleghiamo, qui faccio triage urgenze, follow-up e bozze senza inviare nulla da solo.",
    };
  }

  if (resolved === "system_status") {
    return {
      ok: true,
      action: normalizedAction,
      mode: resolved,
      text: [
        "Sistema attivo:",
        "- autopilot lead-gen in micro-batch",
        "- CRM Fine giornata operativo",
        "- Qwen locale limitato a compiti brevi",
        "- niente invii esterni senza conferma",
      ].join("\n"),
    };
  }

  return {
    ok: true,
    action: normalizedAction,
    mode: resolved,
    text: formatTelegramBriefing(briefing, { mode: resolved, crmUrl }),
  };
}

module.exports = {
  ACTION_MAP,
  resolveNewsAction,
};
