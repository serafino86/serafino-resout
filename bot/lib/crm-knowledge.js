"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const DEFAULT_CRM_PATHS = [
  process.env.CRM_DATA_PATH,
  "/home/enrico/Scrivania/Google Drive/leads_for_sheets.csv",
  "/home/enrico/progetti/crmroma/leads_for_sheets.csv",
  "/home/enrico/planeto/serafino-lead/leads_for_sheets.csv",
].filter(Boolean);

function fileExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}

function resolveExistingPath(candidates) {
  return candidates.find(fileExists) || null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s.@/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    return normalizeText(url.hostname.replace(/^www\./, ""));
  } catch (_) {
    return normalizeText(value.replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0]);
  }
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  out.push(current);
  return out.map((cell) => cell.trim());
}

function parseCsv(content) {
  const lines = String(content || "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    header.forEach((key, index) => {
      row[key] = values[index] || "";
    });
    return row;
  });
}

function addRecordKeys(keys, row) {
  const id = normalizeText(row.ID || row.Id || row.id);
  const company = normalizeText(row.Azienda || row.Company || row.company);
  const email = normalizeText(row.Email || row.email);
  const websiteHost = normalizeHost(row.Website || row.website || row.Sito || row.site);

  if (id) keys.add(`crm:id:${id}`);
  if (company) keys.add(`crm:company:${company}`);
  if (email) keys.add(`crm:email:${email}`);
  if (websiteHost) keys.add(`crm:host:${websiteHost}`);
}

function statusMeansDone(rawStatus) {
  const status = normalizeText(rawStatus);
  if (!status) return false;
  return [
    "done",
    "completato",
    "chiuso",
    "chiusa",
    "converted",
    "won",
    "client",
    "cliente",
    "reply received",
    "meeting booked",
  ].some((token) => status.includes(token));
}

function loadPipelineKnowledge(filePath) {
  if (!fileExists(filePath)) return { runningKeys: [], pipelineSource: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const runningKeys = [];

    for (const [scope, entries] of Object.entries(parsed || {})) {
      for (const [name, item] of Object.entries(entries || {})) {
        if (normalizeText(item?.status) === "running") {
          runningKeys.push(`pipeline:${normalizeText(scope)}:${normalizeText(name)}`);
        }
      }
    }

    return { runningKeys, pipelineSource: filePath };
  } catch (_) {
    return { runningKeys: [], pipelineSource: filePath };
  }
}

function loadCrmKnowledge() {
  const sourcePath = resolveExistingPath(DEFAULT_CRM_PATHS);
  const pipelinePath = resolveExistingPath([process.env.CRM_PIPELINE_STATE_PATH, "/home/enrico/planeto/business-leads-ai-automation/output/pipeline_state.json"].filter(Boolean));
  const keys = new Set();
  const doneKeys = new Set();
  let records = 0;

  if (sourcePath) {
    const rows = parseCsv(fs.readFileSync(sourcePath, "utf8"));
    records = rows.length;
    for (const row of rows) {
      addRecordKeys(keys, row);
      if (statusMeansDone(row.Status || row.status)) {
        const company = normalizeText(row.Azienda || row.Company || row.company);
        const host = normalizeHost(row.Website || row.website || row.Sito || row.site);
        if (company) doneKeys.add(`crm:company:${company}`);
        if (host) doneKeys.add(`crm:host:${host}`);
      }
    }
  }

  const pipeline = loadPipelineKnowledge(pipelinePath);

  return {
    crmKeys: [...keys],
    doneKeys: [...doneKeys],
    runningKeys: pipeline.runningKeys,
    records,
    sourcePath,
    pipelineSource: pipeline.pipelineSource,
  };
}

module.exports = {
  loadCrmKnowledge,
  normalizeText,
};
