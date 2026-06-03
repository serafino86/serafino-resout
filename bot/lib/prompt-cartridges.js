"use strict";

function buildExecutionContract(route, language) {
  const base = [
    `Compression mode: ${route.compressionMode}.`,
    `Route: ${route.name}.`,
    `Reply language: ${language}.`,
  ];

  if (route.name === "short_chat") {
    return base.concat([
      "Goal: answer briefly and naturally.",
      "Do not over-explain.",
      "Do not ask more than one short follow-up question.",
    ]).join("\n");
  }

  if (route.name === "lead_capture") {
    return base.concat([
      "Goal: understand the visitor's activity, problem, and desired improvement.",
      "Qualify before proposing solutions.",
      "Keep the answer compact and concrete.",
    ]).join("\n");
  }

  if (route.name === "crm_status") {
    return base.concat([
      "Goal: answer a pipeline or CRM status question.",
      "Prefer exact status over general advice.",
      "Keep the answer compact and operational.",
    ]).join("\n");
  }

  if (route.name === "ops_diagnosis") {
    return base.concat([
      "Goal: inspect operational health or diagnose what is blocked.",
      "Prefer checks, status, and next action.",
      "Keep the answer short and concrete.",
    ]).join("\n");
  }

  if (route.name === "deep_case") {
    return base.concat([
      "Goal: answer a more detailed or high-friction business question.",
      "Stay concrete and honest.",
      "Prefer compression over long explanations.",
    ]).join("\n");
  }

  return base.join("\n");
}

module.exports = {
  buildExecutionContract,
};
