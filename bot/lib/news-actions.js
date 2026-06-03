"use strict";

const { buildNewsBriefing, markTopNews } = require("./news-store");
const { formatTelegramBriefing } = require("./news-filter");

const ACTION_MAP = {
  A: "open_crm",
  B: "local_models",
  C: "business",
  D: "test_now",
  E: "ignore_today",
};

function resolveNewsAction(action, options = {}) {
  const normalizedAction = String(action || "").trim().toUpperCase();
  const resolved = ACTION_MAP[normalizedAction];
  const crmUrl = String(options.crmUrl || process.env.CRM_DASHBOARD_URL || "").trim();
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
