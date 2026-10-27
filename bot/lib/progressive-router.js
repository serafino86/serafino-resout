"use strict";

const { detectIntentSignals } = require("./intent-signals");

const HEARTBEAT_RE = /^\s*(test\s+hea?r?t?b?e?a?t?h?|test\s+hertbreth|test\s+hertbret|heartbeat|hertbreth|hertbret|heartbreth)\s*[.!?]*\s*$/i;
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
  "mostra crm",
  "apri crm",
  "vedi crm",
  "quanti lead",
  "quanti leed",
  "pipeline",
  "stato lead",
  "stato pipeline",
  "lead abbiamo",
  "crm status",
];

const OPS_DIAGNOSIS_HINTS = [
  "stato",
  "stato sistema",
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

const PERSONAL_MEMORY_HINTS = [
  "ricordami",
  "ricordati",
  "mi ricordi",
  "da ricordare",
  "segnati",
  "segna questa cosa",
  "annota",
  "salva un pensiero",
  "salva questo pensiero",
  "annota questo pensiero",
  "ricordati questo pensiero",
  "salva questa idea",
  "scrivi nei pensieri",
];

const MEMORY_LIST_HINTS = [
  "ricordami i pensieri",
  "mostrami i pensieri",
  "mostrami tutti i pensieri",
  "mostra i pensieri",
  "tutti i pensieri",
  "pensieri salvati",
  "cosa ho salvato",
  "note salvate",
  "ricordi salvati",
];

const MEMORY_FORWARD_HINTS = [
  "manda i pensieri",
  "invia i pensieri",
  "mandali a papa",
  "mandali a papà",
  "invia a papa",
  "invia a papà",
];

const ARTICLE_SAVE_HINTS = [
  "salva articolo",
  "salva questo articolo",
  "salva un articolo",
  "salva link",
];

const NEWS_BRIEFING_HINTS = [
  "rassegna stampa",
  "rassegna stampa is",
  "rassegna stampa ia",
  "rassegna ia",
  "news ia",
  "briefing ia",
  "notizie ia",
  "pannello di scelta",
  "dammi il pannello",
  "apri rassegna",
  "apri la rassegna",
  "aggiorna rassegna",
  "aggiorna la rassegna",
  "nascondi queste",
  "apri crm news",
  "crm news",
];

const NEWS_PREPARE_HINTS = [
  "prepara rassegna",
  "prepara la rassegna",
  "fai lavorare openclaw sulla rassegna",
  "openclaw rassegna",
  "nemotron rassegna",
  "preparami cose pronte",
  "cose pronte dalla rassegna",
];

const CLIENT_EMAIL_HINTS = [
  "ascolta le email",
  "leggi le email",
  "controlla inbox",
  "email cliente",
  "email clienti",
  "email urgenti da clienti",
  "email urgenti",
  "risposte dei clienti",
  "risposte clienti",
  "mail prioritarie",
  "email prioritarie",
  "inbox clienti",
];

const EMAIL_CAMPAIGN_HINTS = [
  "campagna sulle email approvate",
  "campagna email approvate",
  "invia tutte le email approvate",
  "manda tutte le email approvate",
  "manda campagna",
  "fai partire una campagna",
  "lead approvati",
];

const DAILY_RECAP_HINTS = [
  "fine giornata",
  "cosa e stato salvato oggi",
  "cosa è stato salvato oggi",
  "riepilogo giornata",
  "recap giornata",
];

const UPDATE_ALL_HINTS = [
  "aggiorna tutto",
  "aggiorna sistema",
  "aggiorna crm",
  "aggiorna tutto il sistema",
  "fai aggiornamento",
];

const NO_REPLY_HINTS = [
  "no-reply attivo",
  "no reply attivo",
  "attendi solo comandi",
  "attendo comando specifico",
];

const PERSONAL_EMAIL_HINTS = [
  "scrivi una mail a",
  "scrivi un email a",
  "scrivi email a",
  "manda una mail a",
  "manda un email a",
  "manda email a",
  "invia una mail a",
  "invia un email a",
  "invia email a",
  "mail a denise",
  "email a denise",
];

const CALENDAR_EVENT_HINTS = [
  "metti un evento",
  "aggiungi evento",
  "crea evento",
  "aggiungi al calendario",
  "metti in calendario",
  "segna in calendario",
];

const CONTACT_SAVE_HINTS = [
  "salva contatto",
  "aggiungi contatto",
  "memorizza contatto",
  "salva numero",
  "salva questo contatto",
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
  personal_memory: {
    name: "personal_memory",
    compressionMode: "tight",
    kbFiles: [],
    useMemory: false,
    historyLimit: 1,
    maxTokens: 120,
  },
  memory_list: {
    name: "memory_list",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 120,
  },
  memory_forward: {
    name: "memory_forward",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 120,
  },
  article_save: {
    name: "article_save",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 120,
  },
  news_briefing: {
    name: "news_briefing",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 220,
  },
  news_prepare: {
    name: "news_prepare",
    compressionMode: "expanded",
    kbFiles: [
      "01-identity.md",
      "07-conversation-style.md",
      "09-chat-rules.md",
    ],
    useMemory: false,
    historyLimit: 1,
    maxTokens: 750,
  },
  client_email_listen: {
    name: "client_email_listen",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 160,
  },
  email_campaign: {
    name: "email_campaign",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 180,
  },
  daily_recap: {
    name: "daily_recap",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 160,
  },
  update_all: {
    name: "update_all",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 160,
  },
  no_reply: {
    name: "no_reply",
    compressionMode: "bypass",
    kbFiles: [],
    useMemory: false,
    historyLimit: 0,
    maxTokens: 80,
  },
  personal_email: {
    name: "personal_email",
    compressionMode: "tight",
    kbFiles: [],
    useMemory: false,
    historyLimit: 2,
    maxTokens: 180,
  },
  calendar_event: {
    name: "calendar_event",
    compressionMode: "tight",
    kbFiles: [],
    useMemory: false,
    historyLimit: 2,
    maxTokens: 160,
  },
  contact_save: {
    name: "contact_save",
    compressionMode: "tight",
    kbFiles: [],
    useMemory: false,
    historyLimit: 2,
    maxTokens: 140,
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

function matchesPersonalEmail(text) {
  const hasMailAction = /\b(scrivi|manda|invia|prepara)\b/.test(text) && /\b(mail|email|e mail)\b/.test(text);
  const hasRecipient = /\ba\s+[a-z0-9._%+-]{2,}/i.test(text);
  const hasBusinessScope = /\b(lead|leads|cliente|clienti|crm|pipeline|outreach|serafino|preventivo)\b/.test(text);
  return hasMailAction && hasRecipient && !hasBusinessScope;
}

function hasBusinessScope(text) {
  return /\b(lead|leads|cliente|clienti|crm|pipeline|outreach|serafino|preventivo)\b/.test(text);
}

function greetingReply(language, message) {
  if (language === "it") {
    return "Ciao, come stai?";
  }
  if (language === "en") return "Hi. What do you do?";
  if (language === "de-CH") return "Hoi. Was machsch du?";
  return "Salut. Tu fais quoi ?";
}

function classifyRoute(message, history) {
  const text = normalize(message);
  const priorTurns = Array.isArray(history) ? history.length : 0;

  if (!text) return ROUTES.short_chat;
  if (/^[abcdefghij]$/.test(text)) return ROUTES.news_briefing;
  if (/^i\.?a\.?$/.test(text)) return ROUTES.news_briefing;
  if (HEARTBEAT_RE.test(text)) return ROUTES.heartbeat;
  if (GREETING_RE.test(text)) return ROUTES.greeting;
  if (includesAny(text, NEWS_PREPARE_HINTS)) return ROUTES.news_prepare;
  if (includesAny(text, MEMORY_LIST_HINTS)) return ROUTES.memory_list;
  if (includesAny(text, MEMORY_FORWARD_HINTS)) return ROUTES.memory_forward;
  if (includesAny(text, ARTICLE_SAVE_HINTS)) return ROUTES.article_save;
  if (includesAny(text, NEWS_BRIEFING_HINTS)) return ROUTES.news_briefing;
  if (includesAny(text, EMAIL_CAMPAIGN_HINTS)) return ROUTES.email_campaign;
  if (includesAny(text, CLIENT_EMAIL_HINTS)) return ROUTES.client_email_listen;
  if (includesAny(text, DAILY_RECAP_HINTS)) return ROUTES.daily_recap;
  if (includesAny(text, UPDATE_ALL_HINTS)) return ROUTES.update_all;
  if (includesAny(text, NO_REPLY_HINTS)) return ROUTES.no_reply;
  if (includesAny(text, PERSONAL_MEMORY_HINTS)) return ROUTES.personal_memory;
  if (!hasBusinessScope(text) && (includesAny(text, PERSONAL_EMAIL_HINTS) || matchesPersonalEmail(text))) return ROUTES.personal_email;
  if (includesAny(text, CALENDAR_EVENT_HINTS)) return ROUTES.calendar_event;
  if (includesAny(text, CONTACT_SAVE_HINTS)) return ROUTES.contact_save;
  if (includesAny(text, OPS_DIAGNOSIS_HINTS)) return ROUTES.ops_diagnosis;
  if (includesAny(text, CRM_STATUS_HINTS)) return ROUTES.crm_status;
  if (includesAny(text, OPERATIONAL_HINTS)) return ROUTES.lead_capture;
  if (includesAny(text, DEEP_CASE_HINTS) || text.length > 220 || priorTurns > 4) return ROUTES.deep_case;
  return ROUTES.short_chat;
}

function analyzeRoute(message, history) {
  const route = classifyRoute(message, history);
  const rawIntents = detectIntentSignals(message);
  const personalRoutes = new Set(["personal_memory", "personal_email", "calendar_event", "contact_save", "memory_list", "memory_forward", "article_save"]);
  const intents = personalRoutes.has(route.name)
    ? rawIntents.filter((intent) => ["personal_memory", "personal_email", "calendar_event", "contact_save", "greeting"].includes(intent))
    : rawIntents;
  const routeIntentPriority = {
    heartbeat: ["heartbeat", "ops_diagnosis", "crm_status", "lead_search", "lead_enrich", "email_draft", "greeting", "pricing"],
    greeting: ["greeting", "crm_status", "ops_diagnosis", "lead_search", "lead_enrich", "email_draft", "pricing", "heartbeat"],
    personal_memory: ["personal_memory", "greeting"],
    memory_list: ["personal_memory", "greeting"],
    memory_forward: ["personal_email", "personal_memory", "greeting"],
    article_save: ["personal_memory", "greeting"],
    news_briefing: ["greeting"],
    email_campaign: ["email_draft", "greeting"],
    client_email_listen: ["greeting"],
    daily_recap: ["greeting"],
    update_all: ["heartbeat", "crm_status", "greeting"],
    no_reply: ["greeting"],
    personal_email: ["personal_email", "greeting"],
    calendar_event: ["calendar_event", "greeting"],
    contact_save: ["contact_save", "greeting"],
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
