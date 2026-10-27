"use strict";

const DEFAULT_POLICIES = {
  heartbeat: "active",
  greeting: "active",
  personal_memory: "active",
  memory_list: "active",
  memory_forward: "active",
  article_save: "active",
  news_briefing: "active",
  news_prepare: "active",
  email_campaign: "active",
  client_email_listen: "active",
  daily_recap: "active",
  no_reply: "active",
  personal_email: "active",
  calendar_event: "active",
  contact_save: "active",
  short_chat: "shadow",
  crm_status: "shadow",
  ops_diagnosis: "shadow",
  lead_capture: "shadow",
  deep_case: "shadow",
};

function resolveRoutePolicy(routeName) {
  const envKey = `ROUTE_POLICY_${String(routeName || "").toUpperCase()}`;
  const override = String(process.env[envKey] || "").trim().toLowerCase();
  if (override === "active" || override === "shadow" || override === "disabled") {
    return override;
  }
  return DEFAULT_POLICIES[routeName] || "shadow";
}

module.exports = {
  DEFAULT_POLICIES,
  resolveRoutePolicy,
};
