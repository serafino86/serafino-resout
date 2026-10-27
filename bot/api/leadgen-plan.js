"use strict";

const { buildLeadgenPlan, summarizeLeadgenPlan } = require("../lib/leadgen-orchestrator");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  try {
    const plan = buildLeadgenPlan({
      message: body.message,
      country: body.country,
      sector: body.sector,
      query: body.query,
      limit: body.limit,
    });

    return res.status(200).json({
      ok: true,
      summary: summarizeLeadgenPlan(plan),
      plan,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Leadgen plan failed",
    });
  }
};
