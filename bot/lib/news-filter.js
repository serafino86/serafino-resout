"use strict";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_RULES = [
  {
    name: "local_models",
    score: 5,
    patterns: ["gguf", "quantized", "quantization", "local inference", "ollama", "vllm", "llama.cpp", "7b", "8b", "9b", "14b", "consumer gpu"],
  },
  {
    name: "agents",
    score: 4,
    patterns: ["agent framework", "tool calling", "workflow", "agent chaining", "multi-step", "function calling", "orchestration"],
  },
  {
    name: "automation",
    score: 4,
    patterns: ["workflow automation", "crm", "email automation", "scraping", "integration", "zapier", "n8n", "make.com"],
  },
  {
    name: "business",
    score: 4,
    patterns: ["lead generation", "customer service", "sales automation", "marketing automation", "support automation", "small business"],
  },
  {
    name: "api_costs",
    score: 2,
    patterns: ["price cut", "pricing", "latency", "token cost", "cheaper api", "faster inference"],
  },
];

const NOISE_RULES = [
  "500b",
  "671b",
  "benchmark only",
  "academic benchmark",
  "research paper",
  "theoretical analysis",
];

const DEFAULT_MAX_AGE_DAYS = 21;

function detectCategories(text) {
  const lower = normalize(text);
  return CATEGORY_RULES
    .filter((rule) => rule.patterns.some((pattern) => lower.includes(pattern)))
    .map((rule) => rule.name);
}

function scoreItem(item) {
  const haystack = normalize([item.title, item.snippet, item.source].filter(Boolean).join(" "));
  let score = 0;
  const categories = [];

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern))) {
      score += rule.score;
      categories.push(rule.name);
    }
  }

  const noisy = NOISE_RULES.some((pattern) => haystack.includes(pattern));
  if (noisy) score -= 4;

  return {
    score,
    noisy,
    categories: [...new Set(categories)],
  };
}

function parseDate(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : null;
}

function isRecentEnough(item, maxAgeDays = DEFAULT_MAX_AGE_DAYS) {
  const published = parseDate(item.published_at);
  if (!published) return true;
  const ageMs = Date.now() - published;
  return ageMs <= Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
}

function isFakeOrTestItem(item) {
  const url = String(item.url || "").toLowerCase();
  const source = normalize(item.source);
  return url.includes("example.com/") || source.includes("example ai") || source.includes("automation weekly");
}

function isLowSignalProductItem(item) {
  const source = normalize(item.source);
  if (!source.includes("product hunt")) return false;
  const titleWords = normalize(item.title).split(" ").filter(Boolean).length;
  return titleWords <= 2;
}

function isBriefingCandidate(item) {
  return Boolean(item)
    && !item.noisy
    && item.status !== "ignored"
    && (item.score || 0) > 0
    && !isFakeOrTestItem(item)
    && !isLowSignalProductItem(item)
    && isRecentEnough(item);
}

function computeUseCase(item) {
  const categories = item.categories || [];
  if (categories.includes("local_models")) return "utile se migliora modelli locali, costi o velocita.";
  if (categories.includes("agents")) return "utile se semplifica agenti, tool calling o automazioni.";
  if (categories.includes("automation")) return "utile se riduce lavoro su scraping, CRM o email.";
  if (categories.includes("business")) return "utile se diventa un'offerta vendibile o lead generation.";
  if (categories.includes("api_costs")) return "utile se abbassa costi API o latenza.";
  return "da leggere solo se tocca il sistema attuale.";
}

function classifyNewsItem(raw) {
  const item = {
    id: raw.id,
    title: String(raw.title || "").trim(),
    snippet: String(raw.snippet || "").trim(),
    url: String(raw.url || "").trim(),
    source: String(raw.source || "").trim(),
    published_at: raw.published_at || null,
  };

  const { score, noisy, categories } = scoreItem(item);
  return {
    ...item,
    score,
    noisy,
    categories,
    source_group: raw.source_group || null,
    use_case: computeUseCase({ ...item, categories }),
    status: raw.status || "new",
  };
}

function summarizeNews(items) {
  const list = Array.isArray(items) ? items : [];
  const relevant = list.filter(isBriefingCandidate).sort((a, b) => (b.score || 0) - (a.score || 0));
  return {
    total: list.length,
    relevant: relevant.length,
    top: relevant.slice(0, 5),
    ignored: list.filter((item) => item.noisy || item.status === "ignored" || isFakeOrTestItem(item) || isLowSignalProductItem(item) || !isRecentEnough(item)).length,
    byCategory: relevant.reduce((acc, item) => {
      for (const category of item.categories || []) {
        acc[category] = (acc[category] || 0) + 1;
      }
      return acc;
    }, {}),
  };
}

function buildDailyBriefing(items) {
  const summary = summarizeNews(items);
  const top = summary.top;
  if (!top.length) {
    return {
      summary,
      lines: [
        "Nessuna novità ad alta priorità per il tuo stack nelle ultime ore.",
        "Meglio continuare a lavorare sul sistema esistente.",
      ],
    };
  }

  const lines = [
    `Top utili oggi: ${top.length}`,
    ...top.slice(0, 3).map((item, index) => `${index + 1}. ${item.title} — ${item.use_case}`),
  ];

  if (summary.ignored > 0) {
    lines.push(`Rumore ignorato: ${summary.ignored}`);
  }

  return {
    summary,
    lines,
  };
}

function filterBriefingByMode(briefing, mode = "default") {
  const summary = briefing?.summary || {};
  const top = Array.isArray(summary.top) ? summary.top : [];

  if (mode === "local_models") {
    return top.filter((item) => (item.categories || []).includes("local_models"));
  }
  if (mode === "business") {
    return top.filter((item) => (item.categories || []).includes("business") || (item.categories || []).includes("automation"));
  }
  if (mode === "test_now") {
    return top.filter((item) => (item.categories || []).includes("local_models") || (item.categories || []).includes("agents"));
  }
  return top;
}

function formatTelegramBriefing(briefing, options = {}) {
  const mode = String(options.mode || "default").trim();
  const crmUrl = String(options.crmUrl || "").trim();
  const preparedText = String(briefing?.prepared?.text || "").trim();
  if (mode === "default" && preparedText) {
    return [
      preparedText,
      "",
      crmUrl ? `Apri rassegna completa: ${crmUrl}` : null,
    ].filter(Boolean).join("\n");
  }
  const lines = Array.isArray(briefing?.lines) ? briefing.lines : [];
  const summary = briefing?.summary || {};
  const filteredTop = filterBriefingByMode(briefing, mode).slice(0, 3);
  const topLines = filteredTop.length
    ? filteredTop.map((item, index) => {
      const source = item.source ? ` (${item.source})` : "";
      const snippet = String(item.snippet || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const detail = snippet ? `\n   ${snippet.slice(0, 160)}` : "";
      return `${index + 1}. ${item.title}${source}${detail}\n   Perche' conta: ${item.use_case}`;
    })
    : lines;
  const modeLabel = {
    default: "Rassegna stampa IA",
    local_models: "Rassegna IA - modelli locali",
    business: "Rassegna IA - opportunita business",
    test_now: "Rassegna IA - da testare",
  }[mode] || "Rassegna stampa IA";

  return [
    modeLabel,
    "",
    ...topLines,
    "",
    crmUrl ? `Apri rassegna completa: ${crmUrl}` : null,
    "",
    "Comandi utili: apri rassegna, aggiorna rassegna, nascondi queste.",
  ].join("\n");
}

module.exports = {
  classifyNewsItem,
  summarizeNews,
  buildDailyBriefing,
  filterBriefingByMode,
  formatTelegramBriefing,
  detectCategories,
  isBriefingCandidate,
};
