'use strict';

const fs = require('node:fs');
const path = require('node:path');

const GROQ_MODEL        = 'llama-3.1-8b-instant';
const GEMINI_MODEL      = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const OPENROUTER_MODEL  = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct';
const GEMINI_API_URL    = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_TOKENS        = 500;
const MAX_MEMORY_TOKENS = 120;
const RATE_LIMIT_RETRIES = 3;
const DEFAULT_LANGUAGE  = 'fr';
const KB_CACHE_TTL_MS   = 5 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_MEMORY_CHARS  = 1400;

let knowledgeCache = { loadedAt: 0, body: '' };
const promptCache  = new Map();

const LANGUAGE_CONFIG = {
  fr: {
    missingKey:    'Le bot est prêt, mais les clés API sont manquantes dans le fichier .env.',
    rateLimit:     'Le bot est momentanément surchargé. Réessaie dans quelques secondes.',
    genericError:  'Une erreur s\'est produite. Réessaie dans un moment.',
    promptInstruction: 'Write in French.',
  },
  en: {
    missingKey:    'The bot is ready but API keys are missing in the .env file.',
    rateLimit:     'The bot is temporarily under load. Please try again in a few seconds.',
    genericError:  'An error occurred. Please try again.',
    promptInstruction: 'Write in English.',
  },
  it: {
    missingKey:    'Il bot è pronto ma mancano le chiavi API nel file .env.',
    rateLimit:     'Il bot è momentaneamente sotto carico. Riprova tra pochi secondi.',
    genericError:  'Si è verificato un errore. Riprova tra un momento.',
    promptInstruction: 'Write in Italian.',
  },
  'de-CH': {
    missingKey:    'Der Bot ist bereit, aber die API-Schlüssel fehlen in der .env-Datei.',
    rateLimit:     'Der Bot ist momentan ausgelastet. Versuche es in ein paar Sekunden erneut.',
    genericError:  'Ein Fehler ist aufgetreten. Bitte versuche es erneut.',
    promptInstruction: 'Write in German. Use wording natural for Switzerland when appropriate.',
  },
};

function normalizeMessage(message) {
  return String(message || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadKnowledgeBase() {
  const now = Date.now();
  if (knowledgeCache.body && (now - knowledgeCache.loadedAt) < KB_CACHE_TTL_MS) {
    return knowledgeCache.body;
  }

  const kbDir = path.resolve(__dirname, '..', 'serafino-kb');
  if (!fs.existsSync(kbDir)) {
    knowledgeCache = { loadedAt: now, body: '' };
    return '';
  }

  const body = fs
    .readdirSync(kbDir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const fullPath = path.join(kbDir, file);
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      return `## ${file.replace(/\.md$/i, '')}\n${content}`;
    })
    .join('\n\n');

  knowledgeCache = { loadedAt: now, body };
  promptCache.clear();
  return body;
}

function buildSystemPrompt(language, memory) {
  const cacheKey = `${language}::${memory || ''}`;
  if (promptCache.has(cacheKey)) return promptCache.get(cacheKey);

  const kb = loadKnowledgeBase();
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG[DEFAULT_LANGUAGE];

  const prompt = [
    config.promptInstruction,
    `IMPORTANT: Always respond in the language specified above. Never switch to another language. REMINDER: ${config.promptInstruction}`,
    'The knowledge base below is canonical and written in English. Use it as the source of truth, and translate its facts naturally into the requested response language.',
    'You are the assistant for Serafino Résout. Serafino is the professional alter ego of Enrico La Noce.',
    'Your role is to help visitors understand what Serafino does, how he works, whether his offer fits their situation, and how to take the next step.',
    'You must sound human, warm, direct, and honest — like Serafino, Enrico\'s professional alter ego: terrain-first, concrete, never salesy.',
    'Stay strictly within confirmed Serafino Résout knowledge.',
    'Do not invent facts, pricing, client names, or capabilities that are not in the knowledge base.',
    'When the user asks about a false or unconfirmed biography detail, reject it directly and give the confirmed version.',
    'If the user asks about pricing or hidden costs, give the confirmed pricing directly: free diagnostic, 300 CHF simplification plan, implementation from 800 CHF per standalone project, paid once; no hidden software/server/subscription costs. Implementation varies by project complexity.',
    'If something is not confirmed, say so simply and honestly.',
    'Keep answers compact by default. Target: 3 to 6 sentences.',
    'Do not write article-style answers with headings unless the user explicitly asks for a detailed breakdown.',
    'Default maximum length: about 120 words. For broad questions, summarize the essentials and offer to go deeper.',
    'Always finish the answer cleanly. If a full explanation would be long, summarize instead of ending mid-sentence.',
    'Answer first, then ask at most one short follow-up question.',
    'Do not ask multiple stacked questions in the same answer.',
    'When the visitor is skeptical, answer objections directly and say honestly when Serafino may not be the right fit.',
    memory ? `Conversation memory:\n${memory}` : '',
    'Knowledge base:',
    kb,
  ].filter(Boolean).join('\n');

  promptCache.set(cacheKey, prompt);
  return prompt;
}

function isRateLimitError(msg) {
  return /rate limit|too many requests|429|resource exhausted/i.test(msg || '');
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function sanitizeMemory(memory) {
  return String(memory || '').trim().slice(0, MAX_MEMORY_CHARS);
}

function normalizeHistory(history, message) {
  const normalized = history
    .map((entry) => ({
      role: entry && entry.role === 'user' ? 'user' : 'assistant',
      text: String((entry && entry.text) || '').trim(),
    }))
    .filter((entry) => entry.text);

  const trimmed = normalized
    .filter((entry, index) => !(index === 0 && entry.role === 'assistant'))
    .slice(-MAX_HISTORY_MESSAGES);

  const last = trimmed[trimmed.length - 1];
  if (!last || last.role !== 'user' || last.text !== message) {
    trimmed.push({ role: 'user', text: message });
  }

  return trimmed;
}

function toTranscript(history) {
  return history
    .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.text}`)
    .join('\n\n');
}

async function callGemini(systemPrompt, history, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const response = await fetch(
    `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${toTranscript(history)}` }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  const text = String(
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '',
  ).trim();

  if (!response.ok || !text) {
    throw new Error(data?.error?.message || `Gemini error ${response.status}`);
  }
  return text;
}

async function callGroq(systemPrompt, history, maxTokens) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((e) => ({ role: e.role, content: e.text })),
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Groq error ${response.status}`);
  }
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callOpenRouter(systemPrompt, history, maxTokens) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://serafino-resout.ch',
      'X-Title': 'Serafino Résout Bot',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((e) => ({ role: e.role, content: e.text })),
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter error ${response.status}`);
  }
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function withRetries(fn) {
  let lastError;
  for (let attempt = 0; attempt < RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error || '');
      if (!isRateLimitError(msg) || attempt === RATE_LIMIT_RETRIES - 1) throw error;
      await sleep(1200 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unknown chat error');
}

async function generateWithFallback(systemPrompt, history, maxTokens) {
  // 1. OpenRouter (primary)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return { provider: 'openrouter', text: await withRetries(() => callOpenRouter(systemPrompt, history, maxTokens)) };
    } catch (_) { /* fall through */ }
  }
  // 2. Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return { provider: 'gemini', text: await withRetries(() => callGemini(systemPrompt, history, maxTokens)) };
    } catch (_) { /* fall through */ }
  }
  // 3. Groq
  if (process.env.GROQ_API_KEY) {
    return { provider: 'groq', text: await withRetries(() => callGroq(systemPrompt, history, maxTokens)) };
  }

  throw new Error('No AI provider available');
}

async function updateConversationMemory(currentMemory, history, reply) {
  const transcript = toTranscript(history);
  if (!transcript && !reply.trim()) return { memory: currentMemory, provider: null };

  try {
    const result = await generateWithFallback(
      [
        'You maintain a compact conversation memory for a chatbot.',
        'Return only the updated memory, with no preface.',
        'Keep only durable context that helps the next answer.',
        'Include only: visitor profile, main question, key constraints, open topic.',
        'Drop temporary wording, filler, and repeated phrasing.',
        'Use at most 5 short bullet lines.',
        'Write in English for internal use.',
        'If nothing durable is known yet, return: - No durable context yet.',
      ].join('\n'),
      [{ role: 'user', text: [
        'Existing memory:',
        currentMemory || '- No durable context yet.',
        '',
        'Recent conversation:',
        transcript || 'No prior messages.',
        '',
        `Assistant reply: ${reply.trim()}`,
      ].join('\n') }],
      MAX_MEMORY_TOKENS,
    );
    return { memory: sanitizeMemory(result.text) || currentMemory, provider: result.provider };
  } catch {
    return { memory: currentMemory, provider: null };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body     = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const language = LANGUAGE_CONFIG[body.language] ? body.language : DEFAULT_LANGUAGE;
  const config   = LANGUAGE_CONFIG[language];
  const message  = String(body.message || '').trim();
  const history  = Array.isArray(body.messages) ? body.messages : [];
  const currentMemory = sanitizeMemory(body.memory);

  if (!message) return res.status(400).json({ ok: false, error: 'Missing message' });

  const hasKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!hasKey) {
    return res.status(200).json({ ok: true, mode: 'no_api_key', memory: currentMemory, reply: config.missingKey });
  }

  const normalizedHistory = normalizeHistory(history, message);

  try {
    const result = await generateWithFallback(buildSystemPrompt(language, currentMemory), normalizedHistory, MAX_TOKENS);
    const memoryUpdate = await updateConversationMemory(currentMemory, normalizedHistory, result.text);
    return res.status(200).json({
      ok: true,
      mode: `${result.provider}-live`,
      provider: result.provider,
      memory: memoryUpdate.memory,
      memory_provider: memoryUpdate.provider,
      reply: result.text,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown chat error';
    const isRateLimited = isRateLimitError(errorMessage);
    return res.status(isRateLimited ? 429 : 500).json({
      ok: false,
      mode: isRateLimited ? 'all-providers-rate-limited' : 'sdk-error',
      memory: currentMemory,
      error: errorMessage,
      reply: isRateLimited ? config.rateLimit : config.genericError,
    });
  }
};
