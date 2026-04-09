const botState = {
  language: 'fr',
  loading: false,
  messages: [],
  memory: '',
  suggestionsSent: false,
};

const BOT_COPY = {
  fr: {
    welcome: 'Bonjour. Je suis l\'assistant de Serafino Résout. Je peux t\'aider à comprendre si l\'offre de Serafino correspond à ta situation — de façon claire et concrète. Commence par me parler de ton activité ou pose une question directe.',
    placeholder: 'Décris ton problème ou pose une question...',
    suggestions: [
      'C\'est quoi Serafino Résout ?',
      'Comment fonctionne le diagnostic gratuit ?',
      'Je perds du temps sur des tâches répétitives',
      'Je veux un CRM simple pour mon équipe',
      'Combien ça coûte ?',
      'J\'ai un restaurant, comment tu peux m\'aider ?',
    ],
  },
  en: {
    welcome: 'Hello. I\'m the Serafino Résout assistant. I can help you understand whether Serafino\'s offer fits your situation — clearly and concretely. Tell me about your activity or ask a direct question.',
    placeholder: 'Describe your problem or ask a question...',
    suggestions: [
      'What is Serafino Résout?',
      'How does the free diagnostic work?',
      'I waste time on repetitive tasks',
      'I need a simple CRM for my team',
      'What does it cost?',
      'I run a restaurant — how can you help?',
    ],
  },
  it: {
    welcome: 'Ciao. Sono l\'assistente di Serafino Résout. Posso aiutarti a capire se l\'offerta di Serafino fa al caso tuo — in modo chiaro e concreto. Raccontami della tua attività o fai una domanda diretta.',
    placeholder: 'Descrivi il tuo problema o fai una domanda...',
    suggestions: [
      'Cos\'è Serafino Résout?',
      'Come funziona la diagnosi gratuita?',
      'Perdo tempo in attività ripetitive',
      'Voglio un CRM semplice per il mio team',
      'Quanto costa?',
      'Ho un ristorante — come puoi aiutarmi?',
    ],
  },
  'de-CH': {
    welcome: 'Hallo. Ich bin der Assistent von Serafino Résout. Ich kann dir helfen zu verstehen, ob Serafinos Angebot zu deiner Situation passt — klar und konkret. Erzähl mir von deiner Tätigkeit oder stelle eine direkte Frage.',
    placeholder: 'Beschreibe dein Problem oder stelle eine Frage...',
    suggestions: [
      'Was ist Serafino Résout?',
      'Wie funktioniert die kostenlose Diagnose?',
      'Ich verliere Zeit mit wiederkehrenden Aufgaben',
      'Ich brauche ein einfaches CRM für mein Team',
      'Was kostet das?',
      'Ich habe ein Restaurant — wie kannst du mir helfen?',
    ],
  },
};

function escBot(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function autoResizeInput() {
  const input = document.getElementById('botInput');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = Math.max(44, Math.min(input.scrollHeight, 120)) + 'px';
}

function updateBotComposer() {
  const input = document.getElementById('botInput');
  const send = document.getElementById('botSend');
  const copy = BOT_COPY[botState.language];
  if (!input || !send) return;
  input.placeholder = copy.placeholder;
  input.disabled = botState.loading;
  send.disabled = botState.loading || !input.value.trim();
}

function renderSuggestions() {
  const suggestionsEl = document.getElementById('botSuggestions');
  if (!suggestionsEl) return;
  if (botState.suggestionsSent) {
    suggestionsEl.innerHTML = '';
    return;
  }
  const copy = BOT_COPY[botState.language];
  suggestionsEl.innerHTML = copy.suggestions.map(q => `
    <button type="button" class="bot-suggestion-chip" data-question="${escBot(q)}">${escBot(q)}</button>
  `).join('');
  suggestionsEl.onclick = (e) => {
    const btn = e.target.closest('[data-question]');
    if (btn) sendBotMessage(btn.getAttribute('data-question') || '');
  };
}

function appendBubble(role, text) {
  const thread = document.getElementById('botThread');
  if (!thread) return;
  const row = document.createElement('div');
  row.className = `bot-bubble-row ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bot-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  thread.appendChild(row);
  thread.scrollTop = thread.scrollHeight;
}

function showTypingIndicator() {
  const thread = document.getElementById('botThread');
  if (!thread) return;
  const row = document.createElement('div');
  row.className = 'bot-bubble-row bot bot-typing';
  row.id = 'botTyping';
  row.innerHTML = '<div class="bot-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
  thread.appendChild(row);
  thread.scrollTop = thread.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('botTyping');
  if (el) el.remove();
}

function renderThread() {
  const thread = document.getElementById('botThread');
  if (!thread) return;
  thread.innerHTML = '';
  for (const msg of botState.messages) {
    appendBubble(msg.role, msg.text);
  }
}

function setLanguage(lang) {
  botState.language = lang;
  botState.messages = [{ role: 'bot', text: BOT_COPY[lang].welcome }];
  botState.suggestionsSent = false;
  renderThread();
  renderSuggestions();
  updateBotComposer();
}

async function sendBotMessage(rawMessage) {
  const message = String(rawMessage || '').trim();
  const input = document.getElementById('botInput');
  if (!message || botState.loading) return;

  botState.messages = [...botState.messages, { role: 'user', text: message }];
  botState.suggestionsSent = true;
  if (input) { input.value = ''; autoResizeInput(); }
  botState.loading = true;

  appendBubble('user', message);
  renderSuggestions();
  updateBotComposer();
  showTypingIndicator();

  try {
    const data = await API.chatBot({
      message,
      messages: botState.messages,
      language: botState.language,
      memory: botState.memory,
    });
    const reply = String(data.reply || 'Pas de réponse disponible.');
    botState.memory = typeof data.memory === 'string' ? data.memory.trim() : botState.memory;
    botState.messages = [...botState.messages, { role: 'bot', text: reply }];
    removeTypingIndicator();
    appendBubble('bot', reply);
  } catch (err) {
    const errText = String(err.message || 'Erreur.');
    botState.messages = [...botState.messages, { role: 'bot', text: errText }];
    removeTypingIndicator();
    appendBubble('bot', errText);
  } finally {
    botState.loading = false;
    updateBotComposer();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  botState.messages = [{ role: 'bot', text: BOT_COPY[botState.language].welcome }];
  renderThread();
  renderSuggestions();
  updateBotComposer();

  // Sync to visual viewport on mobile (keyboard open/close)
  if (window.visualViewport) {
    const page = document.querySelector('.bot-page');
    const syncViewport = () => {
      if (!page) return;
      page.style.top    = window.visualViewport.offsetTop  + 'px';
      page.style.height = window.visualViewport.height     + 'px';
    };
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
    syncViewport();
  }

  // Language pills
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-lang]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLanguage(btn.dataset.lang);
    });
  });

  const input = document.getElementById('botInput');
  const send  = document.getElementById('botSend');

  if (input) {
    input.addEventListener('input', () => { autoResizeInput(); updateBotComposer(); });
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await sendBotMessage(input.value);
      }
    });
  }

  if (send) {
    send.addEventListener('click', async () => {
      await sendBotMessage(input?.value || '');
    });
  }
});
