"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const DEFAULT_OPENCLAW_PIPELINE_DIR = "/docker/openclaw-yddr/data/openclaw-pipeline";
const DEFAULT_BUSINESS_DIR = "/docker/openclaw-yddr/data/.openclaw/workspace/agent-serafino/11_BUSINESS";

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s.@:/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  const base = String(value || "lead")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return base || `LEAD_${Date.now()}`;
}

function hostOf(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    return normalizeText(url.hostname.replace(/^www\./, ""));
  } catch (_) {
    return normalizeText(value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]);
  }
}

function businessDir() {
  return process.env.BUSINESS_PIPELINE_DIR || DEFAULT_BUSINESS_DIR;
}

function openclawPipelineDir(plan = {}) {
  return process.env.OPENCLAW_PIPELINE_DIR || plan.pipeline_path || DEFAULT_OPENCLAW_PIPELINE_DIR;
}

function pipelinePath() {
  return path.join(businessDir(), "pipeline.json");
}

function readPipeline() {
  const file = pipelinePath();
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

function writePipeline(leads) {
  const file = pipelinePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(leads, null, 2) + "\n", "utf8");
}

function leadKeys(lead) {
  return [
    normalizeText(lead.id),
    normalizeText(lead.company || lead.name),
    normalizeText(lead.email),
    hostOf(lead.website),
  ].filter(Boolean);
}

function isDuplicate(candidate, leads) {
  const keys = new Set(leadKeys(candidate));
  return leads.some((lead) => leadKeys(lead).some((key) => keys.has(key)));
}

function latestJsonFile(outputDir, prefix) {
  if (!fs.existsSync(outputDir)) return null;
  const files = fs.readdirSync(outputDir)
    .filter((name) => name.endsWith(".json") && (!prefix || name.startsWith(prefix)))
    .map((name) => path.join(outputDir, name))
    .filter((file) => fs.statSync(file).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function loadJsonArray(file) {
  if (!file || !fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.leads)) return parsed.leads;
  if (Array.isArray(parsed.items)) return parsed.items;
  return [];
}

function inferSector(raw, fallback) {
  const text = normalizeText([raw.name, raw.company, raw.category, raw.source, fallback].join(" "));
  if (/\b(hotel|albergo|boutique)\b/.test(text)) return "hotels";
  if (/\b(restaurant|ristorante|bistrot|brasserie|horeca|traiteur)\b/.test(text)) return "horeca";
  if (/\b(architect|architet)\b/.test(text)) return "architects";
  if (/\b(fiduciary|fiduciaire|comptable|accounting)\b/.test(text)) return "fiduciaries";
  if (/\b(clinic|clinique|cabinet|therap)\b/.test(text)) return "clinics";
  return fallback || "smb";
}

function mapLead(raw, plan = {}) {
  const name = String(raw.name || raw.company || raw.title || "").trim();
  if (!name) return null;
  const id = `lead-${slug(name)}`;
  const website = String(raw.website || raw.site || raw.url || "").trim();
  const email = String(raw.email || raw.contact_email || "").trim();
  const phone = String(raw.phone || raw.telephone || raw.tel || "").trim();
  const notes = [
    raw.address ? `Indirizzo: ${raw.address}` : null,
    raw.source ? `Fonte: ${raw.source}` : null,
    raw.intelligence?.score ? `Score fonte: ${raw.intelligence.score}` : null,
    raw.intelligence?.recommendation ? `Nota fonte: ${raw.intelligence.recommendation}` : null,
  ].filter(Boolean).join(" | ");

  return {
    id,
    name,
    company: name,
    sector: inferSector(raw, plan.sector),
    stage: "NUOVO_LEAD",
    tier: raw.intelligence?.priority === "HIGH" ? "A" : "B",
    score: Number(raw.intelligence?.score || raw.score || 60),
    created_at: nowDate(),
    stage_updated_at: nowDate(),
    email,
    phone,
    website,
    source: raw.source || "openclaw_pipeline",
    lost_reason: null,
    notes,
    file: `11_BUSINESS/leads/${slug(name)}.md`,
    updated_at: nowDate(),
    enrichment: {
      discovered_at: nowIso(),
      source_file: raw.__source_file || null,
    },
  };
}

function writeLeadMarkdown(lead) {
  const file = path.join(businessDir(), "leads", `${slug(lead.company)}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = [
    `# ${lead.company}`,
    "",
    `- Stato: ${lead.stage}`,
    `- Settore: ${lead.sector}`,
    `- Email: ${lead.email || ""}`,
    `- Telefono: ${lead.phone || ""}`,
    `- Sito: ${lead.website || ""}`,
    `- Fonte: ${lead.source || ""}`,
    `- Score: ${lead.score || ""}`,
    "",
    "## Note",
    lead.notes || "",
  ].join("\n");
  fs.writeFileSync(file, body + "\n", "utf8");
}

function runDiscover(plan = {}) {
  const cwd = openclawPipelineDir(plan);
  const country = String(plan.country || "CH").toUpperCase();
  const script = country === "UK" ? "uk" : country === "IT" ? "italy" : "swiss";
  const query = String(plan.query || plan.sector || "smb");
  const limit = String(Math.max(1, Math.min(3, Number(plan.limit || 1))));
  const before = Date.now();

  execFileSync("npm", ["run", script, "--", "--query", query, "--limit", limit], {
    cwd,
    timeout: Number(process.env.LEADGEN_SCRIPT_TIMEOUT_MS || 90000),
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
  });

  const outputDir = path.join(cwd, "output");
  const prefix = script === "swiss" ? "swiss_leads_" : null;
  const latest = latestJsonFile(outputDir, prefix);
  if (!latest || fs.statSync(latest).mtimeMs < before - 5000) {
    return { ok: false, action: "lead_search", message: "Nessun file nuovo prodotto dallo script.", output_file: latest };
  }

  const rawLeads = loadJsonArray(latest).map((item) => ({ ...item, __source_file: latest }));
  const pipeline = readPipeline();
  for (const raw of rawLeads) {
    const mapped = mapLead(raw, plan);
    if (!mapped || isDuplicate(mapped, pipeline)) continue;
    pipeline.push(mapped);
    writePipeline(pipeline);
    writeLeadMarkdown(mapped);
    return { ok: true, action: "lead_search", lead_id: mapped.id, company: mapped.company, output_file: latest };
  }

  return { ok: false, action: "lead_search", message: "Script eseguito, ma nessun lead nuovo dopo deduplica.", output_file: latest };
}

function enrichOneLead() {
  const leads = readPipeline();
  const target = leads.find((lead) =>
    !lead.email
    && lead.website
    && lead.enrichment?.status !== "checked_no_verified_email"
  );
  if (!target) return { ok: false, action: "lead_enrich", message: "Nessun lead arricchibile senza email e con sito." };

  target.enrichment = {
    ...(target.enrichment || {}),
    checked_at: nowIso(),
    status: "checked_no_verified_email",
    note: "Non inventare email. Serve verifica da sito, tool email o fonte esterna.",
  };
  target.updated_at = nowDate();
  writePipeline(leads);
  writeLeadMarkdown(target);
  return { ok: true, action: "lead_enrich", lead_id: target.id, company: target.company, email_found: false };
}

function draftForLead(lead) {
  const company = lead.company || lead.name;
  const sector = lead.sector || "azienda locale";
  const signal = lead.notes ? `Ho visto alcuni segnali pubblici su ${company}: ${lead.notes}.` : `Ho visto la vostra presenza online.`;
  return {
    subject: `Possibile automazione leggera per ${company}`,
    body: [
      `Buongiorno,`,
      "",
      signal,
      "",
      `Lavoro su piccoli sistemi per ridurre lavoro manuale su richieste, follow-up e gestione contatti, senza cambiare gli strumenti che usate gia'.`,
      "",
      `Per realta' ${sector} di solito parto da un controllo semplice: dove si perde tempo, quali messaggi arrivano spesso, quali risposte si possono preparare meglio.`,
      "",
      `Se ha senso, posso mandarvi 2-3 idee pratiche dopo aver guardato il vostro caso.`,
      "",
      `Cordiali saluti,`,
      `Enrico`,
    ].join("\n"),
    created_at: nowIso(),
    status: "DRAFT_READY",
  };
}

function prepareOneDraft() {
  const leads = readPipeline();
  const target = leads.find((lead) => lead.email && !lead.draft);
  if (!target) return { ok: false, action: "email_draft", message: "Nessun lead con email senza bozza." };
  target.draft = draftForLead(target);
  target.stage = target.stage === "NUOVO_LEAD" ? "BOZZA_PRONTA" : target.stage;
  target.stage_updated_at = nowDate();
  target.updated_at = nowDate();
  writePipeline(leads);
  writeLeadMarkdown(target);
  return { ok: true, action: "email_draft", lead_id: target.id, company: target.company, subject: target.draft.subject };
}

function executeBusinessStep(task, step) {
  if (!task || task.route !== "lead_capture") return null;
  const plan = task.metadata?.leadgen_plan || {};
  if (task.primary_intent === "lead_search" && step === "discover_one_lead") return runDiscover(plan);
  if (task.primary_intent === "lead_enrich" && step === "enrich_one_contact") return enrichOneLead();
  if (task.primary_intent === "email_draft" && step === "prepare_outreach") return prepareOneDraft();
  return null;
}

module.exports = {
  executeBusinessStep,
  readPipeline,
  pipelinePath,
};
