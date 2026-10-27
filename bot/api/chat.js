'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { analyzeRoute, buildDirectReply } = require('../lib/progressive-router');
const { buildExecutionContract } = require('../lib/prompt-cartridges');
const { buildExecutionPlan } = require('../lib/openclaw-contract');
const { appendShadowEvent } = require('../lib/shadow-log');

const GROQ_MODEL        = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'; // llama-3.3-70b ritirato da Groq (27.10.2026)
// free tier Groq = 8000 token/min PER MODELLO, ~4k per richiesta: i fallback hanno limiti separati
const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
const GEMINI_MODEL      = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const OPENROUTER_MODEL          = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';
const OPENROUTER_MODEL_FALLBACK = 'nvidia/nemotron-3-super-120b-a12b:free';
const GEMINI_API_URL    = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_TOKENS        = 500;
const MAX_EMAIL_TOKENS  = 750;
const MAX_MEMORY_TOKENS = 120;
const RATE_LIMIT_RETRIES = 3;
const DEFAULT_LANGUAGE  = 'fr';
const KB_CACHE_TTL_MS   = 5 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_MEMORY_CHARS  = 1400;

let knowledgeCache = { loadedAt: 0, sections: new Map() };
const promptCache  = new Map();

const LANGUAGE_CONFIG = {
  fr: {
    missingKey:    'Le bot est prêt, mais les clés API sont manquantes dans le fichier .env.',
    rateLimit:     'Le bot est momentanément surchargé. Réessayez dans quelques secondes.',
    genericError:  'Une erreur s\'est produite. Réessayez dans un moment.',
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

function loadKnowledgeBase(selectedFiles) {
  const now = Date.now();
  const kbDir = path.resolve(__dirname, '..', 'serafino-kb');
  if (!fs.existsSync(kbDir)) {
    knowledgeCache = { loadedAt: now, sections: new Map() };
    return '';
  }

  if ((now - knowledgeCache.loadedAt) >= KB_CACHE_TTL_MS || !(knowledgeCache.sections instanceof Map)) {
    const sections = new Map();
    for (const file of fs.readdirSync(kbDir).filter((entry) => entry.endsWith('.md')).sort()) {
      const fullPath = path.join(kbDir, file);
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      sections.set(file, `## ${file.replace(/\.md$/i, '')}\n${content}`);
    }
    knowledgeCache = { loadedAt: now, sections };
    promptCache.clear();
  }

  const files = Array.isArray(selectedFiles) && selectedFiles.length
    ? selectedFiles.filter((file) => knowledgeCache.sections.has(file))
    : [...knowledgeCache.sections.keys()];

  return files.map((file) => knowledgeCache.sections.get(file)).filter(Boolean).join('\n\n');
}

function buildSystemPrompt(language, memory, route) {
  const routeName = route?.name || 'default';
  const kbKey = Array.isArray(route?.kbFiles) ? route.kbFiles.join(',') : '*';
  const cacheKey = `${language}::${routeName}::${kbKey}::${memory || ''}`;
  if (promptCache.has(cacheKey)) return promptCache.get(cacheKey);

  const kb = loadKnowledgeBase(route?.kbFiles);
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
  const executionContract = buildExecutionContract(route || { name: 'default', compressionMode: 'expanded' }, language);

  const prompt = [
    executionContract,
    'ABSOLUTE RULE — address the visitor with "vous" in French (vous/votre/vos), like the website. Never "tu".',
    config.promptInstruction,
    `IMPORTANT: Always respond in the language specified above. Never switch to another language. REMINDER: ${config.promptInstruction}`,
    'The knowledge base below is canonical and written in English. Use it as the source of truth, and translate its facts naturally into the requested response language.',
    'You are the assistant for Serafino Résout. Serafino is the working alter ego of Enrico La Noce, a chef for events and collective catering with 20 years in professional kitchens, based in Geneva.',
    'Serafino Résout offers ONE product: "L\'heure du téléphone", a phone line that answers when a restaurant or a craftsman cannot. It is in a pilot phase in Geneva: Enrico is looking for the first ten restaurants and craftsmen.',
    'Your role: understand whether the visitor is a restaurant, a craftsman or something else, explain the line simply, and guide them to contact Enrico (contact@serafino-resout.ch, 078 658 37 60) to try it.',
    'QUALIFY FIRST: if the visitor\'s trade is not clear, ask one short question (restaurant, artisan, autre ?) before explaining.',
    'HONEST FIT: if the visitor is neither a restaurant nor a craftsman, say the line is made for them, and invite the visitor to write to Enrico for any other need. Never force a fit.',
    'Stay strictly within the knowledge base. Never invent prices, clients, results, figures, features or dates.',
    'PRICES: only those of the knowledge base (Restaurant 249 CHF/month, Artisan 119 CHF/month, 30 days free for the first ten). Never mention a diagnostic, a 300 CHF plan, 800 CHF, Centralina packages, 99/149/199/299 CHF: these offers no longer exist.',
    'Never give a demo phone number. Never say "mes clients" or "nos clients": the line has no paying client yet.',
    'Points not decided (VAT/HT, commitment, what happens beyond included minutes): say Enrico will answer precisely, give his contact.',
    'When the user asks about a false or unconfirmed biography detail, reject it directly and give the confirmed version.',
    'STRICT LENGTH RULE: maximum 3 sentences per answer. ONE paragraph only.',
    'No headings or bullet lists unless the user explicitly asks for a breakdown. Always finish the answer cleanly.',
    'Answer first, then ask at most one short follow-up question.',
    '⚠ FORBIDDEN PHRASES: "Bien sûr", "Excellente question", "Je comprends votre situation", "enjeu clé", "levier stratégique", "nos clients", "nous proposons". Speak as "je", warm and direct, short sentences, like a real person from the kitchen, not a brochure.',
    'FEW-SHOT EXAMPLE — VISITOR: "Vous avez déjà des clients ?" CORRECT RESPONSE: "On démarre : je cherche les dix premiers restaurants et artisans genevois, c\'est pour ça que l\'essai est gratuit 30 jours. Vous êtes dans quel métier ?"',
    memory ? `Conversation memory:\n${memory}` : '',
    'Knowledge base:',
    kb,
  ].filter(Boolean).join('\n');

  promptCache.set(cacheKey, prompt);
  return prompt;
}

function sanitizeReply(text) {
  if (!text) return text;
  const before = text;
  let t = text
    // Strip formal empathy openers (keep rest of sentence after colon/dash)
    .replace(/^Je comprends ton scepticisme\s*[:\-–—]\s*/i, '')
    .replace(/^Je comprends ton doute\s*[:\-–—]\s*/i, '')
    .replace(/^Je comprends votre\s*[:\-–—]\s*/i, '')
    .replace(/^Je comprends que\s+tu\s+[a-zéèêëàùûüôîï]+\s+[a-zéèêëàùûüôîï]+\s*[:\-–—,]?\s*/i, 'Normal — ')
    .replace(/^Bien sûr[,!]?\s*/i, '')
    .replace(/^Bien entendu[,!]?\s*/i, '')
    .replace(/^Absolument[,!]?\s*/i, '')
    // Replace jargon
    .replace(/protocole d['']usage convenu/gi, 'ce qu\'on a défini ensemble')
    .replace(/résultat(?:s)? mesurable(?:s)? selon les critères/gi, 'résultat concret')
    .replace(/mise en œuvre/gi, 'mise en place')
    .replace(/utilisation conforme/gi, 'usage normal')
    .replace(/point(?:s)? de friction opérationnel(?:le)?(?:s)?/gi, 'ce qui coince')
    .replace(/problème(?:s)? opérationnel(?:le)?(?:s)?/gi, 'problème concret')
    .replace(/levier(?:s)? stratégique(?:s)?/gi, 'levier concret')
    .replace(/enjeu(?:x)? clé(?:s)?/gi, 'enjeu principal');
  // Capitalise first letter if we stripped the opener
  if (t !== before) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

function truncateToSentences(text, max) {
  const t = String(text || '').trim();
  // Match sentences ending with . ! ? (including ... and ?) followed by space or end
  const sentences = t.match(/[^.!?…]+(?:[.!?…]+(?:\s|$))/g) || [];
  if (!sentences.length) return t;
  if (sentences.length <= max) return t;
  return sentences.slice(0, max).join('').trim();
}

function isRateLimitError(msg) {
  return /rate limit|too many requests|429|resource exhausted/i.test(msg || '');
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function sanitizeMemory(memory) {
  return String(memory || '').trim().slice(0, MAX_MEMORY_CHARS);
}

function normalizeHistory(history, message, historyLimit = MAX_HISTORY_MESSAGES) {
  const normalized = history
    .map((entry) => ({
      role: entry && entry.role === 'user' ? 'user' : 'assistant',
      text: String((entry && entry.text) || '').trim(),
    }))
    .filter((entry) => entry.text);

  const trimmed = normalized
    .filter((entry, index) => !(index === 0 && entry.role === 'assistant'))
    .slice(-historyLimit);

  const last = trimmed[trimmed.length - 1];
  if (message && (!last || last.role !== 'user' || last.text !== message)) {
    trimmed.push({ role: 'user', text: message });
  }

  return trimmed;
}

function toTranscript(history) {
  return history
    .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.text}`)
    .join('\n\n');
}

function safeJsonParse(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) { /* continue */ }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

function cleanField(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function missingLabels(language, items) {
  const labels = {
    fr: {
      activity: 'activité',
      problem: 'problème principal',
      improvement: 'amélioration souhaitée',
      timing: 'urgence ou calendrier',
      contact: 'coordonnées',
    },
    en: {
      activity: 'activity',
      problem: 'main problem',
      improvement: 'desired improvement',
      timing: 'urgency or timing',
      contact: 'contact details',
    },
    it: {
      activity: 'attività',
      problem: 'problema principale',
      improvement: 'miglioramento desiderato',
      timing: 'urgenza o tempistiche',
      contact: 'contatto',
    },
    'de-CH': {
      activity: 'Tätigkeit',
      problem: 'Hauptproblem',
      improvement: 'gewünschte Verbesserung',
      timing: 'Dringlichkeit oder Zeitplan',
      contact: 'Kontaktangaben',
    },
  };
  const langLabels = labels[language] || labels.fr;
  const found = new Set();
  const normalized = Array.isArray(items) ? items : [];

  for (const item of normalized) {
    const text = normalizeMessage(item);
    if (/activ|attiv|tatig|tätig|business|activity/.test(text)) found.add('activity');
    else if (/problem|problema|friction|pain|haupt/.test(text)) found.add('problem');
    else if (/improv|amelior|amélior|miglior|objectif|obiettivo|goal|ziel/.test(text)) found.add('improvement');
    else if (/urgent|urgen|timing|temp|calend|zeit|when|quando/.test(text)) found.add('timing');
    else if (/contact|coord|mail|email|phone|telefono|tel|kontakt/.test(text)) found.add('contact');
  }

  return [...found].map((key) => langLabels[key]);
}

function buildEmailBody(language, summary, missing) {
  const cleanSummary = cleanField(summary, 900);
  const missingList = missing.length ? missing.map((item) => `- ${item}`).join('\n') : '';

  if (language === 'it') {
    return [
      'Ciao Serafino,',
      '',
      'Ho parlato con il tuo assistente e vorrei capire se puoi aiutarmi.',
      '',
      'Riepilogo:',
      cleanSummary || '- Da completare',
      '',
      missingList ? 'Informazioni ancora da completare:' : '',
      missingList,
      '',
      'Grazie,',
    ].filter((line) => line !== '').join('\n');
  }
  if (language === 'en') {
    return [
      'Hello Serafino,',
      '',
      'I spoke with your assistant and would like to understand whether you can help.',
      '',
      'Summary:',
      cleanSummary || '- To complete',
      '',
      missingList ? 'Information still to complete:' : '',
      missingList,
      '',
      'Thank you,',
    ].filter((line) => line !== '').join('\n');
  }
  if (language === 'de-CH') {
    return [
      'Hallo Serafino,',
      '',
      'Ich habe mit deinem Assistenten gesprochen und möchte klären, ob du mir helfen kannst.',
      '',
      'Zusammenfassung:',
      cleanSummary || '- Zu ergänzen',
      '',
      missingList ? 'Noch fehlende Informationen:' : '',
      missingList,
      '',
      'Danke,',
    ].filter((line) => line !== '').join('\n');
  }
  return [
    'Bonjour Serafino,',
    '',
    'J\'ai échangé avec votre assistant et j\'aimerais voir si vous pouvez m\'aider.',
    '',
    'Résumé:',
    cleanSummary || '- À compléter',
    '',
    missingList ? 'Informations encore à compléter:' : '',
    missingList,
    '',
    'Merci,',
  ].filter((line) => line !== '').join('\n');
}

function defaultEmailDraft(language, currentMemory, history) {
  const transcript = toTranscript(history).slice(-1200);
  const isIt = language === 'it';
  const isEn = language === 'en';
  const isDe = language === 'de-CH';
  const subject = isIt ? 'Primo scambio - caso da chiarire'
    : isEn ? 'First conversation - case to clarify'
    : isDe ? 'Erstes Gespräch - Situation klären'
    : 'Premier échange - situation à clarifier';
  const missing = missingLabels(language, ['contact']);
  const body = buildEmailBody(language, currentMemory || transcript, missing);

  return {
    subject,
    summary: currentMemory || '',
    missing,
    body,
  };
}

async function prepareLeadEmail(language, currentMemory, history) {
  const transcript = toTranscript(history).slice(-6000);
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
  const fallback = defaultEmailDraft(language, currentMemory, history);

  const result = await generateWithFallback(
    [
      config.promptInstruction,
      'You prepare a concise email draft from a Serafino Résout chatbot conversation.',
      'Return only valid JSON. No markdown. No code fences.',
      'Read the full transcript carefully. Extract every piece of information already stated by the visitor: their activity, problem, what they want to improve, urgency, and contact details.',
      'Only mark a field as "missing" if it was genuinely never mentioned anywhere in the conversation or memory. If the visitor said they run a restaurant, do not mark "activity" as missing.',
      'The only truly essential missing field is contact details (email or phone). Activity and problem should already be in the conversation. Only list "contact" as missing if the visitor has never provided any contact information.',
      'Do not write the final email body. Only provide the summary, subject, and missing enum items.',
      'Recipient is Serafino at contact@serafino-resout.ch.',
      'JSON shape: {"subject":"...","summary":"...","missing":["activity","contact"]}',
    ].join('\n'),
    [{ role: 'user', text: [
      'Conversation memory:',
      currentMemory || '- No durable context yet.',
      '',
      'Conversation transcript:',
      transcript || '- No transcript.',
    ].join('\n') }],
    MAX_EMAIL_TOKENS,
  );

  const parsed = safeJsonParse(result.text) || fallback;
  return {
    subject: cleanField(parsed.subject || fallback.subject, 120) || fallback.subject,
    summary: cleanField(parsed.summary || fallback.summary, 900),
    missing: missingLabels(language, Array.isArray(parsed.missing) ? parsed.missing : fallback.missing),
    body: '',
    provider: result.provider,
  };
}

function fetchWithTimeout(url, options, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function callGemini(systemPrompt, history, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const response = await fetchWithTimeout(
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

async function callGroq(systemPrompt, history, maxTokens, model = GROQ_MODEL) {
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((e) => ({ role: e.role, content: e.text })),
      ],
      max_tokens: maxTokens + 256, // gpt-oss spende token nel ragionamento prima della risposta
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
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
  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
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

async function callOpenRouterModel(model, systemPrompt, history, maxTokens, timeoutMs) {
  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://serafino-resout.ch',
      'X-Title': 'Serafino Résout Bot',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((e) => ({ role: e.role, content: e.text })),
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  }, timeoutMs);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter error ${response.status}`);
  }
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function generateWithFallback(systemPrompt, history, maxTokens) {
  // 0. Groq gpt-oss-120b: unico motore gratuito funzionante al 27.10.2026
  //    (OpenRouter free ritirati + credito finito, Gemini prepagato esaurito)
  if (process.env.GROQ_API_KEY) {
    try {
      return { provider: 'groq', text: await withRetries(() => callGroq(systemPrompt, history, maxTokens)) };
    } catch (_) { /* fall through */ }
    for (const model of GROQ_FALLBACK_MODELS) {
      try {
        return { provider: `groq-${model.split('/').pop()}`, text: await callGroq(systemPrompt, history, maxTokens, model) };
      } catch (_) { /* fall through */ }
    }
  }
  // 1. OpenRouter primary (gpt-oss-120b, fast)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return { provider: 'openrouter', text: await withRetries(() => callOpenRouterModel(OPENROUTER_MODEL, systemPrompt, history, maxTokens, 5000)) };
    } catch (_) { /* fall through */ }
  }
  // 2. Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return { provider: 'gemini', text: await withRetries(() => callGemini(systemPrompt, history, maxTokens)) };
    } catch (_) { /* fall through */ }
  }
  // 4. OpenRouter fallback (nemotron, slow but high quality — only reachable if others fail fast)
  if (process.env.OPENROUTER_API_KEY) {
    return { provider: 'openrouter-nemotron', text: await withRetries(() => callOpenRouterModel(OPENROUTER_MODEL_FALLBACK, systemPrompt, history, maxTokens, 12000)) };
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
  const analysis = analyzeRoute(message, history);
  const route = analysis.route;
  const executionPlan = buildExecutionPlan({
    route,
    language,
    message,
    history,
    memory: currentMemory,
    intents: analysis.intents,
    primaryIntent: analysis.primaryIntent,
    secondaryIntents: analysis.secondaryIntents,
  });

  if (body.action === 'prepare_email') {
    const normalized = normalizeHistory(history, '', route.historyLimit || MAX_HISTORY_MESSAGES);
    const fallback = defaultEmailDraft(language, currentMemory, normalized);
    const hasKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!hasKey) {
      return res.status(200).json({
        ok: true,
        mode: 'fallback-email-draft',
        memory: currentMemory,
        draft: {
          to: 'contact@serafino-resout.ch',
          subject: fallback.subject,
          summary: fallback.summary,
          missing: fallback.missing,
          body: fallback.body,
        },
      });
    }

    try {
      const draft = await prepareLeadEmail(language, currentMemory, normalized);
      const bodyText = buildEmailBody(language, draft.summary, draft.missing);
      return res.status(200).json({
        ok: true,
        mode: `${draft.provider}-email-draft`,
        provider: draft.provider,
        memory: currentMemory,
        draft: {
          to: 'contact@serafino-resout.ch',
          subject: draft.subject,
          summary: draft.summary,
          missing: draft.missing,
          body: bodyText,
        },
      });
    } catch (error) {
      return res.status(200).json({
        ok: true,
        mode: 'fallback-email-draft',
        memory: currentMemory,
        draft: {
          to: 'contact@serafino-resout.ch',
          subject: fallback.subject,
          summary: fallback.summary,
          missing: fallback.missing,
          body: fallback.body,
        },
      });
    }
  }

  const directReply = buildDirectReply(route, language, message);
  if (directReply) {
    appendShadowEvent({
      source: 'chat',
      route: route.name,
      language,
      message,
      dispatchMode: 'direct',
      target: 'direct',
      modelProfile: executionPlan.model_profile,
      compressionMode: executionPlan.compression_mode,
      hasReply: true,
      error: null,
    });
    return res.status(200).json({
      ok: true,
      mode: `direct-${route.name}`,
      route: route.name,
      intents: analysis.intents,
      secondary_intents: analysis.secondaryIntents,
      compression_mode: route.compressionMode,
      memory: currentMemory,
      reply: directReply,
    });
  }

  const hasKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!hasKey) {
    appendShadowEvent({
      source: 'chat',
      route: route.name,
      language,
      message,
      dispatchMode: 'no_api_key',
      target: executionPlan.executor,
      modelProfile: executionPlan.model_profile,
      compressionMode: executionPlan.compression_mode,
      hasReply: true,
      error: null,
    });
    return res.status(200).json({
      ok: true,
      mode: 'no_api_key',
      route: route.name,
      intents: analysis.intents,
      secondary_intents: analysis.secondaryIntents,
      compression_mode: route.compressionMode,
      memory: currentMemory,
      reply: config.missingKey,
    });
  }

  if (!message) return res.status(400).json({ ok: false, error: 'Missing message' });

  const normalizedHistory = normalizeHistory(history, message, route.historyLimit || MAX_HISTORY_MESSAGES);
  const effectiveMemory = route.useMemory ? currentMemory : '';

  try {
    const result = await generateWithFallback(
      buildSystemPrompt(language, effectiveMemory, route),
      normalizedHistory,
      route.maxTokens || MAX_TOKENS,
    );
    const reply = sanitizeReply(truncateToSentences(result.text, 5));
    const memoryUpdate = route.useMemory
      ? await updateConversationMemory(currentMemory, normalizedHistory, reply)
      : { memory: currentMemory, provider: null };
    const userMessageCount = normalizedHistory.filter((m) => m.role === 'user').length;
    const proactiveEmail = userMessageCount === 3 && currentMemory.trim() && reply ? true : undefined;
    appendShadowEvent({
      source: 'chat',
      route: route.name,
      language,
      message,
      dispatchMode: `${result.provider}-live`,
      target: executionPlan.executor,
      modelProfile: executionPlan.model_profile,
      compressionMode: executionPlan.compression_mode,
      hasReply: true,
      error: null,
    });
    return res.status(200).json({
      ok: true,
      mode: `${result.provider}-live`,
      provider: result.provider,
      route: route.name,
      intents: analysis.intents,
      secondary_intents: analysis.secondaryIntents,
      compression_mode: route.compressionMode,
      memory: memoryUpdate.memory,
      memory_provider: memoryUpdate.provider,
      reply,
      ...(proactiveEmail ? { proactive_email: true } : {}),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown chat error';
    const isRateLimited = isRateLimitError(errorMessage);
    appendShadowEvent({
      source: 'chat',
      route: route.name,
      language,
      message,
      dispatchMode: isRateLimited ? 'rate_limited' : 'sdk_error',
      target: executionPlan.executor,
      modelProfile: executionPlan.model_profile,
      compressionMode: executionPlan.compression_mode,
      hasReply: false,
      error: errorMessage,
    });
    return res.status(isRateLimited ? 429 : 500).json({
      ok: false,
      mode: isRateLimited ? 'all-providers-rate-limited' : 'sdk-error',
      route: route.name,
      intents: analysis.intents,
      secondary_intents: analysis.secondaryIntents,
      compression_mode: route.compressionMode,
      memory: currentMemory,
      reply: isRateLimited ? config.rateLimit : config.genericError,
    });
  }
};
