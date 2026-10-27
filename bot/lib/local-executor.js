"use strict";

const fs = require("node:fs");
const path = require("node:path");

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
const OPENROUTER_MODEL_NEMOTRON = "nvidia/nemotron-3-super-120b-a12b:free";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const ROUTER_PATH = path.resolve(__dirname, "..", "config", "local-model-router.json");

function buildMessages(prompt) {
  return [
    {
      role: "system",
      content: "Execute the provided contract exactly. Return only the final user-facing answer.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

async function postJson(url, payload, headers = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenRouter(model, prompt, maxTokens) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not set");
  }
  const data = await postJson(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages: buildMessages(prompt),
      max_tokens: maxTokens,
      temperature: 0.2,
    },
    {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://serafino-resout.ch",
      "X-Title": "Serafino Progressive Executor",
    },
    model === OPENROUTER_MODEL_NEMOTRON ? 16000 : 8000,
  );
  return {
    provider: "openrouter",
    model,
    reply: String(data?.choices?.[0]?.message?.content || "").trim(),
    raw: data,
  };
}

async function callGemini(prompt, maxTokens) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set");
  }
  const data = await postJson(
    `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    {},
    10000,
  );
  return {
    provider: "gemini",
    model: GEMINI_MODEL,
    reply: String(data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "").trim(),
    raw: data,
  };
}

async function callGroq(prompt, maxTokens) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not set");
  }
  const data = await postJson(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: GROQ_MODEL,
      messages: buildMessages(prompt),
      max_tokens: maxTokens,
      temperature: 0.2,
    },
    {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    10000,
  );
  return {
    provider: "groq",
    model: GROQ_MODEL,
    reply: String(data?.choices?.[0]?.message?.content || "").trim(),
    raw: data,
  };
}

function loadLocalModelRouter() {
  try {
    return JSON.parse(fs.readFileSync(ROUTER_PATH, "utf8"));
  } catch (_) {
    return null;
  }
}

function selectOllamaModel(modelProfile, prompt, router) {
  const models = router?.ollama?.models || {};
  const routes = router?.ollama?.routes || {};
  const text = String(prompt || "").toLowerCase();
  let route = routes.default || "main";

  if (modelProfile === "local-fast" || text.length < 900) route = routes.short || "fast";
  if (/codice|coding|debug|script|stack trace|errore|function|const |import |docker|systemd/.test(text)) {
    route = routes.coding || "code";
  }
  if (/openclaw|automazione|crm|lead|pipeline|scraping|worker|supervisor/.test(text)) {
    route = routes.automation || "main";
  }

  return models[route] || models.main || "qwen3:9b";
}

async function callOllama(prompt, maxTokens, modelProfile) {
  if (String(process.env.OLLAMA_LOCAL_ENABLED || "off").trim().toLowerCase() !== "on") {
    throw new Error("OLLAMA_LOCAL_ENABLED is off");
  }

  const router = loadLocalModelRouter();
  const baseUrl = String(process.env.OLLAMA_BASE_URL || router?.ollama?.base_url || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = selectOllamaModel(modelProfile, prompt, router);
  const limits = router?.ollama?.limits || {};

  const data = await postJson(
    `${baseUrl}/api/generate`,
    {
      model,
      prompt,
      stream: false,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE || limits.keep_alive || "5m",
      options: {
        num_ctx: Number(process.env.OLLAMA_NUM_CTX || limits.num_ctx || 4096),
        num_predict: Math.max(64, Math.min(Number(limits.num_predict || 512), Number(maxTokens || 512))),
        temperature: Number(limits.temperature ?? 0.2),
      },
    },
    {},
    Number(process.env.OLLAMA_TIMEOUT_MS || 30000),
  );

  return {
    provider: "ollama",
    model,
    reply: String(data?.response || "").trim(),
    raw: data,
  };
}

async function executeContract(params) {
  const prompt = String(params.prompt || "").trim();
  const modelProfile = String(params.model_profile || "local-fast").trim();
  const maxTokens = Math.max(64, Number(params.max_tokens || 420));

  if (!prompt) {
    throw new Error("Missing prompt");
  }

  if (modelProfile === "nemotron") {
    return callOpenRouter(OPENROUTER_MODEL_NEMOTRON, prompt, Math.max(256, maxTokens));
  }

  try {
    return await callOllama(prompt, maxTokens, modelProfile);
  } catch (_) {
    // Local model is optional. Fall through to configured cloud fallbacks.
  }

  try {
    return await callOpenRouter(OPENROUTER_MODEL, prompt, maxTokens);
  } catch (_) {
    try {
      return await callGemini(prompt, maxTokens);
    } catch (_) {
      return callGroq(prompt, maxTokens);
    }
  }
}

module.exports = {
  executeContract,
};
