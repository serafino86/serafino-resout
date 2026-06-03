"use strict";

const HEARTBEAT_RE = /^\s*(test\s+hea?r?t?b?e?a?t?h?|test\s+hertbreth|heartbeat|hertbreth|heartbreth)\s*[.!?]*\s*$/i;
const GREETING_RE = /^\s*(ciao|buongiorno|buonasera|buon\s+pomeriggio|hey|ehi|hello|salve)\s*[.!?]*\s*$/i;

const SIGNALS = {
  heartbeat: [
    "heartbeat",
    "hertbreth",
    "heartbreth",
    "test heartbeat",
    "test hertbreth",
  ],
  greeting: [
    "ciao",
    "buongiorno",
    "buonasera",
    "salve",
    "hello",
  ],
  crm_status: [
    "quanti lead",
    "quanti leed",
    "pipeline",
    "stato lead",
    "stato pipeline",
    "lead abbiamo",
    "crm",
  ],
  ops_diagnosis: [
    "autodiagnosi",
    "auto diagnosi",
    "diagnosi",
    "check sistema",
    "bloccato",
    "cosa e bloccato",
    "cosa è bloccato",
  ],
  lead_search: [
    "cerca lead",
    "trova lead",
    "lead nuovi",
    "lead simili",
  ],
  lead_enrich: [
    "arricchisci",
    "trova email",
    "trova sito",
    "email e sito",
    "sito web",
  ],
  email_draft: [
    "bozza email",
    "scrivi email",
    "prepara email",
    "crea bozza",
  ],
  pricing: [
    "quanto costa",
    "prezzo",
    "prezzi",
    "garanzia",
    "rimborsi",
    "rimborso",
  ],
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntentSignals(message) {
  const text = normalize(message);
  const hits = [];

  if (HEARTBEAT_RE.test(text) || SIGNALS.heartbeat.some((pattern) => text.includes(pattern))) hits.push("heartbeat");
  if (GREETING_RE.test(text) || SIGNALS.greeting.some((pattern) => text.includes(pattern))) hits.push("greeting");

  for (const [intent, patterns] of Object.entries(SIGNALS)) {
    if (intent === "heartbeat" || intent === "greeting") continue;
    if (patterns.some((pattern) => text.includes(pattern))) hits.push(intent);
  }

  return [...new Set(hits)];
}

module.exports = {
  detectIntentSignals,
};
