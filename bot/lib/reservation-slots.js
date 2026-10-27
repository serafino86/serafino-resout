'use strict';

const WORD_NUMBERS = {
  'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
  'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  'uno': 1, 'due': 2, 'tre': 3, 'quattro': 4, 'cinque': 5,
};

const DAY_KEYS = [
  'ce soir', 'demain soir', 'demain', 'ce week-end', 'ce weekend',
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
  'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica',
  'weekend', 'week-end',
];

const NAME_STOP = /\b(je m['']appelle|mon pr[eé]nom|c['']est|je suis|bonjour|bonsoir|salut|all[oô])\b/gi;

function norm(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function extractName(text) {
  const cleaned = text.replace(NAME_STOP, '').replace(/[.,!?]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return null;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
}

function extractParty(text) {
  const m = text.match(/\b(\d{1,2})\b/);
  if (m) return parseInt(m[1], 10);
  const low = norm(text);
  for (const [word, val] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`).test(low)) return val;
  }
  return null;
}

// TEMPORAL_HINT: parole che indicano chiaramente un giorno/periodo
const TEMPORAL_HINT = /\b(soir|matin|midi|soir|nuit|week|fin|prochain|semaine|mois|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|janvier|f[eé]vrier|mars|avril|mai|\d{1,2}[\/\-]\d{1,2})\b/i;

function extractDay(text, { fallback = false } = {}) {
  const low = norm(text);
  for (const day of DAY_KEYS) {
    if (low.includes(norm(day))) return day;
  }
  // fallback solo se testo contiene indicatore temporale O siamo in fase ask_day
  if (fallback || TEMPORAL_HINT.test(text)) {
    return text.trim().slice(0, 40) || null;
  }
  return null;
}

// TIME_HINT: parole che indicano chiaramente un orario
const TIME_HINT = /\b(heure[s]?|h\d|midi|minuit|\d{1,2}[h:]\d{0,2})\b/i;

function extractTime(text, { fallback = false } = {}) {
  const m = text.match(/\b(\d{1,2})[h:]\s*(\d{0,2})\b/i);
  if (m) return `${m[1]}h${m[2] || '00'}`;
  const m2 = text.match(/\b(\d{1,2})\s+heure[s]?\s*(\d{0,2})/i);
  if (m2) return `${m2[1]}h${m2[2] || '00'}`;
  if (text.toLowerCase().includes('midi'))   return '12h00';
  if (text.toLowerCase().includes('minuit')) return '00h00';
  // fallback solo se testo contiene indicatore orario O siamo in fase ask_time
  if (fallback || TIME_HINT.test(text)) {
    return text.trim().slice(0, 20) || null;
  }
  return null;
}

function isYes(text) {
  return /\b(oui|yes|si|s[iì]|exact|parfait|correct|d['']accord|ok)\b/i.test(norm(text));
}

async function correctNameGroq(rawName, fullText) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return rawName;
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Extract only the caller first name from the transcription. Return ONLY the name, nothing else. Examples: "C\'est Steph alors" → "Steph", "Je m\'appelle Marco Rossi" → "Marco", "Stefano Anna" → "Stefano", "Indigo" → "Enrico".',
          },
          { role: 'user', content: fullText },
        ],
        temperature: 0,
        max_tokens: 10,
      }),
    });
    const d = await resp.json();
    const name = (d.choices?.[0]?.message?.content || '').trim().split(/\s+/)[0];
    return name || rawName;
  } catch {
    return rawName;
  }
}

async function extractSlots(session, text) {
  const s = { ...session };

  // fase conferma
  if (s.phase === 'confirming') {
    s.phase = isYes(text) ? 'done' : 'greeting';
    if (s.phase === 'greeting') {
      delete s.name;
      delete s.party;
      delete s.day;
      delete s.time;
    }
    return s;
  }

  // estrai tutti gli slot dall'utterance corrente
  const askDay  = s.phase === 'ask_day';
  const askTime = s.phase === 'ask_time';

  if (!s.name)  { const n = extractName(text);                    if (n) s.name  = n; }
  if (!s.party) { const p = extractParty(text);                   if (p) s.party = p; }
  if (!s.day)   { const d = extractDay(text,  { fallback: askDay  }); if (d) s.day   = d; }
  if (!s.time)  { const t = extractTime(text, { fallback: askTime }); if (t) s.time  = t; }

  // Groq solo se nome ambiguo (parole extra o stopwords residue)
  if (s.name && (s.name.split(' ').length > 1 || /\b(alors|donc|bien|voila|voilà)\b/i.test(s.name))) {
    s.name = await correctNameGroq(s.name, text);
  }

  s.phase = !s.name  ? 'ask_name'
          : !s.party ? 'ask_party'
          : !s.day   ? 'ask_day'
          : !s.time  ? 'ask_time'
          : 'confirming';

  return s;
}

function nextQuestion(s) {
  const p = s.party === 1 ? 'personne' : 'personnes';
  switch (s.phase) {
    case 'ask_name':    return 'Quel est votre prénom ?';
    case 'ask_party':  return `Merci ${s.name} ! Pour combien de personnes ?`;
    case 'ask_day':    return 'Quel jour souhaitez-vous venir ?';
    case 'ask_time':   return 'À quelle heure ?';
    case 'confirming': return `Parfait ${s.name} ! ${s.party} ${p}, ${s.day} à ${s.time}. Dites oui pour confirmer.`;
    case 'done':       return `Merci ${s.name} ! Réservation reçue. Vous recevrez un SMS. À bientôt !`;
    default:           return 'Bienvenue chez Serafino ! Quel est votre prénom ?';
  }
}

module.exports = { extractSlots, nextQuestion };
