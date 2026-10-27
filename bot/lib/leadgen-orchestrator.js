"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CONFIG_PATH = path.join(__dirname, "..", "config", "leadgen-phases.json");

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCountry(value, fallback = "CH") {
  const raw = normalizeText(value).toUpperCase();
  if (["CH", "SWISS", "SWITZERLAND", "SUISSE", "SVIZZERA"].includes(raw)) return "CH";
  if (["UK", "GB", "UNITED KINGDOM", "ENGLAND"].includes(raw)) return "UK";
  if (["IT", "ITALY", "ITALIA"].includes(raw)) return "IT";
  return fallback;
}

function inferCountry(message, fallback = "CH") {
  const text = normalizeText(message).toLowerCase();
  if (/\b(uk|united kingdom|england|londra|london)\b/.test(text)) return "UK";
  if (/\b(it|italia|italy|roma|milano|torino|napoli)\b/.test(text)) return "IT";
  if (/\b(ch|svizzera|suisse|switzerland|ginevra|geneve|genève|lugano|zurigo|zürich)\b/.test(text)) return "CH";
  return fallback;
}

function inferLimit(message, fallback) {
  const match = normalizeText(message).match(/\b(\d{1,3})\b/);
  if (!match) return fallback;
  const limit = Number(match[1]);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(100, limit));
}

function inferSector(message, fallback = "smb") {
  const text = normalizeText(message).toLowerCase();
  const sectors = [
    ["smb", /\b(pmi|smb|small business|aziende locali|local businesses)\b/],
    ["restaurants", /\b(ristoranti|restaurant|restaurants|horeca|cucine|cucina)\b/],
    ["hotels", /\b(hotel|alberghi|boutique hotel)\b/],
    ["architects", /\b(architetti|architect|architects|studi di architettura)\b/],
    ["fiduciaries", /\b(fiduciarie|fiduciary|accounting|comptable|commercialisti)\b/],
    ["clinics", /\b(cliniche|clinics|cabinet|therapist|terapisti)\b/],
  ];
  const found = sectors.find(([, re]) => re.test(text));
  return found ? found[0] : fallback;
}

function commandWithArgs(base, args = []) {
  const cleanBase = normalizeText(base);
  if (!cleanBase) return null;
  const cleanArgs = args.filter(Boolean);
  const separator = cleanArgs.length && cleanBase.startsWith("npm run ") && !cleanBase.includes(" -- ") ? "--" : null;
  return [cleanBase, separator, ...cleanArgs].filter(Boolean).join(" ");
}

function buildLeadgenPlan(input = {}) {
  const config = readConfig();
  const message = normalizeText(input.message);
  const defaults = config.defaults || {};
  const country = normalizeCountry(input.country || inferCountry(message, defaults.country), defaults.country);
  const limit = inferLimit(input.limit || message, defaults.limit || 20);
  const sector = normalizeText(input.sector) || inferSector(message, defaults.sector);
  const query = normalizeText(input.query) || sector;
  const countryCommands = config.countries?.[country];

  if (!countryCommands) {
    throw new Error(`Unsupported leadgen country: ${country}`);
  }

  const args = [`--limit ${limit}`];
  if (query) args.unshift(`--query "${query.replace(/"/g, '\\"')}"`);

  const phases = (config.phases || []).map((phase) => {
    let command = null;
    if (phase.name === "discover") command = commandWithArgs(countryCommands.discover, args);
    if (phase.name === "contact_enrich") {
      command = [
        commandWithArgs(countryCommands.email, [`--limit ${limit}`]),
        commandWithArgs(countryCommands.phone, [`--limit ${limit}`]),
      ].filter(Boolean).join(" && ");
    }
    if (phase.name === "decision_maker") command = commandWithArgs(countryCommands.team, [`--limit ${limit}`]);
    if (phase.name === "pain_points") command = commandWithArgs(countryCommands.articles, [`--limit ${limit}`]);
    if (phase.name === "sync") command = commandWithArgs(countryCommands.sync);

    return {
      name: phase.name,
      kind: phase.kind,
      writes: Boolean(phase.writes),
      requires_confirmation: Boolean(phase.requiresConfirmation),
      description: phase.description,
      command,
      status: command || phase.kind === "model" || phase.kind === "state" ? "planned" : "unavailable",
    };
  });

  return {
    version: config.version || 1,
    created_at: new Date().toISOString(),
    mode: "plan-only",
    country,
    sector,
    query,
    limit,
    pipeline_path: defaults.pipelinePath,
    phases,
    rules: [
      "No model invents contacts, emails, decision makers, or pain points.",
      "External writes require confirmation.",
      "Scripts must return explicit success or error strings.",
      "OpenClaw receives compact phase summaries only.",
    ],
  };
}

function summarizeLeadgenPlan(plan) {
  const lines = [
    `Lead-gen plan: ${plan.country} / ${plan.sector} / limit ${plan.limit}`,
    `Pipeline: ${plan.pipeline_path}`,
  ];
  for (const phase of plan.phases) {
    const lock = phase.requires_confirmation ? " (conferma richiesta)" : "";
    lines.push(`- ${phase.name}: ${phase.status}${lock}`);
  }
  return lines.join("\n");
}

module.exports = {
  CONFIG_PATH,
  buildLeadgenPlan,
  summarizeLeadgenPlan,
};
