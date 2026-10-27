"use strict";

const HEARTBEAT_RE = /^\s*(test\s+hea?r?t?b?e?a?t?h?|test\s+hertbreth|test\s+hertbret|heartbeat|hertbreth|hertbret|heartbreth)\s*[.!?]*\s*$/i;
const GREETING_RE = /^\s*(ciao|buongiorno|buonasera|buon\s+pomeriggio|hey|ehi|hello|salve)\s*[.!?]*\s*$/i;

const SIGNALS = {
  heartbeat: [
    "heartbeat",
    "hertbreth",
    "hertbret",
    "heartbreth",
    "test heartbeat",
    "test hertbreth",
    "test hertbret",
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
  personal_memory: [
    "ricordami",
    "ricordati",
    "mi ricordi",
    "da ricordare",
    "segnati",
    "annota",
    "salva un pensiero",
    "salva questo pensiero",
    "annota questo pensiero",
    "ricordati questo pensiero",
    "salva questa idea",
    "scrivi nei pensieri",
  ],
  personal_email: [
    "scrivi una mail a",
    "scrivi un email a",
    "scrivi email a",
    "manda una mail a",
    "manda un email a",
    "manda email a",
    "invia una mail a",
    "invia un email a",
    "invia email a",
    "scrivi a denise",
    "mail personale",
  ],
  calendar_event: [
    "metti un evento",
    "aggiungi evento",
    "crea evento",
    "aggiungi al calendario",
    "metti in calendario",
    "segna in calendario",
  ],
  contact_save: [
    "salva contatto",
    "aggiungi contatto",
    "memorizza contatto",
    "salva numero",
    "salva questo contatto",
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
