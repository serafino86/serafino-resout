"use strict";

const DEFAULT_POLICIES = {
  heartbeat: "active",
  greeting: "active",
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
