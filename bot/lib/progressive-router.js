"use strict";

const { detectIntentSignals } = require("./intent-signals");

const HEARTBEAT_RE = /^\s*(test\s+hea?r?t?b?e?a?t?h?|test\s+hertbreth|heartbeat|hertbreth|heartbreth)\s*[.!?]*\s*$/i;
const GREETING_RE = /^\s*(ciao|buongiorno|buonasera|buon\s+pomeriggio|hey|ehi|hello|salve)\s*[.!?]*\s*$/i;

const OPERATIONAL_HINTS = [
  "lead",
  "leads",
  "email",
  "crm",
  "pipeline",
  "task",
  "preventivo",
  "bozza",
  "bozze",
  "invia",
  "cliente",
  "clienti",
  "calendario",
  "agenda",
  "contatto",
  "contatti",
  "diagnosi",
  "autodiagnosi",
];

const CRM_STATUS_HINTS = [
  "quanti lead",
  "quanti leed",
  "pipeline",
  "stato lead",
  "stato pipeline",
  "lead abbiamo",
  "crm status",
];

const OPS_DIAGNOSIS_HINTS = [
  "autodiagnosi",
  "auto diagnosi",
  "diagnosi",
  "fai autodiagnosi",
  "check sistema",
  "cosa e bloccato",
  "cosa è bloccato",
  "bloccato",
  "heartbeat check",
];

const DEEP_CASE_HINTS = [
  "prezzo",
  "prezzi",
  "pricing",
  "combien",
  "quanto costa",
  "tarif",
  "processo",
  "garanzia",
  "caso",
  "casi",
  "settore",
  "secteur",
  "startup",
  "horeca",
  "restaurant",
  "ristorante",
  "cabinet",
  "studio",
];

const ROUTES = {
  heartbeat: {
    name: "heartbeat",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 8,
  },
  greeting: {
    name: "greeting",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 24,
  },
  short_chat: {
    name: "short_chat",
    compressionMode: "tight",
    kbFiles: [
      "01-identity.md",
      "02-services.md",
      "07-conversation-style.md",
      "09-chat-rules.md",
    ],
    useMemory: false,
    historyLimit: 3,
    maxTokens: 220,
  },
  crm_status: {
    name: "crm_status",
    compressionMode: "focused",
    kbFiles: [
      "01-identity.md",
      "02-services.md",
      "07-conversation-style.md",
      "09-chat-rules.md",
    ],
    useMemory: true,
    historyLimit: 4,
    maxTokens: 260,
  },
  ops_diagnosis: {
    name: "ops_diagnosis",
    compressionMode: "tight",
    kbFiles: [
      "01-identity.md",
      "07-conversation-style.md",
      "09-chat-rules.md",
    ],
    useMemory: false,
    historyLimit: 2,
    maxTokens: 180,
  },
  lead_capture: {
    name: "lead_capture",
    compressionMode: "focused",
    kbFiles: [
      "01-identity.md",
      "02-services.md",
      "04-cases.md",
      "06-sectors.md",
      "07-conversation-style.md",
      "09-chat-rules.md",
    ],
    useMemory: true,
    historyLimit: 5,
    maxTokens: 420,
  },
  deep_case: {
    name: "deep_case",
    compressionMode: "expanded",
    kbFiles: [
      "01-identity.md",
      "02-services.md",
      "03-method.md",
      "04-cases.md",
      "05-pricing.md",
      "06-sectors.md",
      "07-conversation-style.md",
      "08-faq.md",
      "09-chat-rules.md",
    ],
    useMemory: true,
    historyLimit: 6,
    maxTokens: 650,
  },
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function greetingReply(language, message) {
  const t = normalize(message);
  if (language === "it") {
    if (t.includes("buongiorno")) return "Buongiorno. Cosa fai?";
    if (t.includes("buonasera")) return "Buonasera. Cosa fai?";
    return "Ciao. Cosa fai?";
  }
  if (language === "en") return "Hi. What do you do?";
  if (language === "de-CH") return "Hoi. Was machsch du?";
  return "Salut. Tu fais quoi ?";
}

function classifyRoute(message, history) {
  const text = normalize(message);
  const priorTurns = Array.isArray(history) ? history.length : 0;

  if (!text) return ROUTES.short_chat;
  if (HEARTBEAT_RE.test(text)) return ROUTES.heartbeat;
  if (GREETING_RE.test(text)) return ROUTES.greeting;
  if (includesAny(text, OPS_DIAGNOSIS_HINTS)) return ROUTES.ops_diagnosis;
  if (includesAny(text, CRM_STATUS_HINTS)) return ROUTES.crm_status;
  if (includesAny(text, OPERATIONAL_HINTS)) return ROUTES.lead_capture;
  if (includesAny(text, DEEP_CASE_HINTS) || text.length > 220 || priorTurns > 4) return ROUTES.deep_case;
  return ROUTES.short_chat;
}

function analyzeRoute(message, history) {
  const route = classifyRoute(message, history);
  const intents = detectIntentSignals(message);
  const routeIntentPriority = {
    heartbeat: ["heartbeat", "ops_diagnosis", "crm_status", "lead_search", "lead_enrich", "email_draft", "greeting", "pricing"],
    greeting: ["greeting", "crm_status", "ops_diagnosis", "lead_search", "lead_enrich", "email_draft", "pricing", "heartbeat"],
    crm_status: ["crm_status", "ops_diagnosis", "email_draft", "lead_search", "lead_enrich", "pricing", "heartbeat", "greeting"],
    ops_diagnosis: ["ops_diagnosis", "crm_status", "email_draft", "lead_search", "lead_enrich", "pricing", "heartbeat", "greeting"],
    lead_capture: ["lead_search", "lead_enrich", "email_draft", "crm_status", "ops_diagnosis", "heartbeat", "greeting", "pricing"],
    deep_case: ["pricing", "crm_status", "ops_diagnosis", "lead_search", "lead_enrich", "email_draft", "heartbeat", "greeting"],
    short_chat: ["greeting", "crm_status", "ops_diagnosis", "lead_search", "lead_enrich", "email_draft", "pricing", "heartbeat"],
  };
  const primaryIntentMap = {
    heartbeat: "heartbeat",
    greeting: "greeting",
  };
  const priority = routeIntentPriority[route.name] || [];
  const primaryIntent =
    primaryIntentMap[route.name]
    || priority.find((intent) => intents.includes(intent))
    || intents[0]
    || route.name;
  const secondaryIntents = intents.filter((intent) => intent !== primaryIntent);

  return {
    route,
    intents,
    primaryIntent,
    secondaryIntents,
  };
}

function buildDirectReply(route, language, message) {
  if (route.name === "heartbeat") return "HEARTBEAT_OK";
  if (route.name === "greeting") return greetingReply(language, message);
  return null;
}

module.exports = {
  ROUTES,
  classifyRoute,
  analyzeRoute,
  buildDirectReply,
};
