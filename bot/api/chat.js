'use strict';

const fs = require('node:fs');
const path = require('node:path');

const GROQ_MODEL        = 'llama-3.3-70b-versatile';
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
    '⚠ RÈGLE ABSOLUE — TUTOIEMENT: Utilise TOUJOURS "tu" pour t\'adresser au visiteur. Jamais "vous", jamais "votre", jamais "vos". Utilise: tu, te, toi, ton, ta, tes. Cette règle prime sur tout le reste.',
    'ABSOLUTE RULE — TUTOIEMENT: Always address the visitor with "tu" in French. NEVER use vous/votre/vos for the visitor. Use: tu, te, toi, ton, ta, tes. This overrides everything.',
    config.promptInstruction,
    `IMPORTANT: Always respond in the language specified above. Never switch to another language. REMINDER: ${config.promptInstruction}`,
    'The knowledge base below is canonical and written in English. Use it as the source of truth, and translate its facts naturally into the requested response language.',
    'You are the assistant for Serafino Résout. Serafino is the professional alter ego of Enrico La Noce.',
    'Your role is to help visitors understand what Serafino does, how he works, whether his offer fits their situation, and how to take the next step — ideally by preparing a contact email together.',
    'You must sound human, warm, direct, and honest — like Serafino, Enrico\'s professional alter ego: terrain-first, concrete, never salesy.',
    'PRIORITY GOAL: understand the visitor\'s situation (their activity, their problem, what they want to improve) and guide them naturally toward preparing a contact email for Serafino.',
    'QUALIFY FIRST: if the visitor\'s profession or sector is not immediately clear, ask one short direct question before proposing anything. Never suggest solutions before knowing who you are talking to.',
    'LANGUAGE ADAPTATION: mirror the visitor\'s professional vocabulary. If they use industry-specific terms, use them back. Speak their language, not generic consulting jargon.',
    'HONEST FIT CHECK: if the visitor\'s activity has no real operational or digital overlap with the target sectors (SMEs, HORECA, liberal professions, service businesses, startups), say clearly and directly that you are probably not the right person — but leave a door open for operational problems they might have.',
    'PIVOT RULE: if you previously flagged a visitor as out-of-target, and they then reveal concrete operational problems (team, suppliers, invoicing, scheduling, Excel chaos), do NOT immediately switch to "I can help perfectly." Acknowledge the shift explicitly: restate what they said, explain why it is different from your initial response, then confirm it is in scope. The transition must feel honest — not like you will say anything to sell.',
    '⚠ NEVER mention prices, costs, or CHF amounts unless the visitor explicitly asks. Do not volunteer pricing information when describing services or the offer. If the conversation naturally reaches a point where pricing is relevant and the visitor has not asked, still do not mention it — wait for them to ask.',
    'Stay strictly within confirmed Serafino Résout knowledge.',
    'Do not invent facts, pricing, client names, or capabilities that are not in the knowledge base.',
    'When the user asks about a false or unconfirmed biography detail, reject it directly and give the confirmed version.',
    'If the visitor explicitly asks about pricing or costs, give the confirmed pricing directly: free diagnostic, 300 CHF simplification plan, implementation from 800 CHF per standalone project, paid once; no hidden software/server/subscription costs. Implementation varies by project complexity.',
    'If something is not confirmed, say so simply and honestly.',
    'STRICT LENGTH RULE: maximum 3 sentences per answer. ONE paragraph only. If you need more, you are writing too much — cut ruthlessly.',
    'Do not write article-style answers with headings or bullet lists unless the user explicitly asks for a detailed breakdown.',
    'Always finish the answer cleanly. If a full explanation would be long, summarize instead of ending mid-sentence.',
    'Answer first, then ask at most one short follow-up question.',
    'Do not ask multiple stacked questions in the same answer.',
    'When the visitor is skeptical, answer objections directly and say honestly when Serafino may not be the right fit.',
    '⚠ ABSOLUTE FORBIDDEN PHRASES — never use these, ever: "Je comprends ton scepticisme", "Je comprends votre", "Bien sûr", "Excellente question", "protocole d\'usage convenu", "résultat mesurable selon les critères", "enjeu clé", "levier stratégique", "mise en œuvre", "utilisation conforme". These phrases sound like a brochure. Serafino does not talk like this.',
    '⚠ TONE RULE: Serafino uses casual French. "c\'est", "t\'as", "ça", "truc", "franchement", "vraiment". Short sentences. Direct. Warm but not cheerful. Like a real person who knows the field, not a consultant writing a report.',
    '⚠ SKEPTICISM RULE: When someone doubts or pushes back, do NOT start with "Je comprends ton scepticisme". Instead: validate briefly (1 short clause), then give one concrete real-world example with a real number. Then ask one question. Maximum 3 sentences total.',
    'FEW-SHOT EXAMPLE — How to respond to skepticism:',
    'VISITOR: "Tout le monde dit ça. Consultant terrain, outil sur mesure... C\'est le speech classique. Et j\'ai déjà payé 5000 CHF pour un PDF."',
    'CORRECT RESPONSE: "Normal d\'être méfiant — 5000 CHF pour un PDF c\'est exactement ce que je veux éviter. Planeto: 1800 contacts transformés en 756 leads qualifiés, livré en 5 semaines, zéro abonnement, tout ça sur clé USB plug & play. Tu bosses dans quel secteur ?"',
    'WRONG RESPONSE: "Je comprends ton scepticisme : la vraie différence se voit dans les résultats concrets..." — THIS IS FORBIDDEN.',
    'FEW-SHOT EXAMPLE — How to explain the guarantee:',
    'VISITOR: "La garantie c\'est bien sur le papier mais ça veut dire quoi concrètement ?"',
    'CORRECT RESPONSE: "Si ça marche pas en 3 mois en faisant ce qu\'on a défini ensemble — je rembourse. C\'est écrit, pas juste dit. T\'as quel type de business ?"',
    'WRONG RESPONSE: "La garantie signifie que si tu suis le protocole d\'usage convenu et qu\'aucun résultat mesurable n\'apparaît..." — THIS IS FORBIDDEN.',
    memory ? `Conversation memory:\n${memory}` : '',
    'Knowledge base:',
    kb,
  ].filter(Boolean).join('\n');

  promptCache.set(cacheKey, prompt);
  return prompt;
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

async function callGroq(systemPrompt, history, maxTokens) {
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
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
  // 3. Groq (llama)
  if (process.env.GROQ_API_KEY) {
    try {
      return { provider: 'groq', text: await withRetries(() => callGroq(systemPrompt, history, maxTokens)) };
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

  if (body.action === 'prepare_email') {
    const normalized = normalizeHistory(history, '');
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

  const hasKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!hasKey) {
    return res.status(200).json({ ok: true, mode: 'no_api_key', memory: currentMemory, reply: config.missingKey });
  }

  if (!message) return res.status(400).json({ ok: false, error: 'Missing message' });

  const normalizedHistory = normalizeHistory(history, message);

  try {
    const result = await generateWithFallback(buildSystemPrompt(language, currentMemory), normalizedHistory, MAX_TOKENS);
    const reply = truncateToSentences(result.text, 5);
    const memoryUpdate = await updateConversationMemory(currentMemory, normalizedHistory, reply);
    const userMessageCount = normalizedHistory.filter((m) => m.role === 'user').length;
    const proactiveEmail = userMessageCount === 3 && currentMemory.trim() && reply ? true : undefined;
    return res.status(200).json({
      ok: true,
      mode: `${result.provider}-live`,
      provider: result.provider,
      memory: memoryUpdate.memory,
      memory_provider: memoryUpdate.provider,
      reply,
      ...(proactiveEmail ? { proactive_email: true } : {}),
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
