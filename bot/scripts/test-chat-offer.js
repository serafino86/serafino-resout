'use strict';
// Unit checks: email offer from the 3rd user message, KB/prompt free of old offers.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const chat = require('../api/chat');
const { classifyRoute } = require('../lib/progressive-router');

const welcome = { role: 'bot', text: 'Bonjour' };
const h = (n) => {
  const out = [welcome];
  for (let i = 1; i <= n; i += 1) {
    out.push({ role: 'user', text: `msg ${i}` });
    if (i < n) out.push({ role: 'bot', text: `rep ${i}` });
  }
  return out;
};
assert.strictEqual(chat.shouldOfferEmail(h(1), 'msg 1'), false);
assert.strictEqual(chat.shouldOfferEmail(h(2), 'msg 2'), false);
assert.strictEqual(chat.shouldOfferEmail(h(3), 'msg 3'), true);
assert.strictEqual(chat.shouldOfferEmail(h(4), 'msg 4'), true);
// old bug: msgs 1-2 go to short_chat (useMemory false) so memory stayed empty
// and the old rule `count === 3 && memory` never fired
assert.strictEqual(classifyRoute('msg 2', h(2)).useMemory, false);
// message not yet in history still counts
assert.strictEqual(chat.shouldOfferEmail(h(2), 'nouveau'), true);

const kbDir = path.join(__dirname, '..', 'serafino-kb');
const kb = fs.readdirSync(kbDir).filter((f) => f.endsWith('.md'))
  .map((f) => fs.readFileSync(path.join(kbDir, f), 'utf8')).join('\n');
const prompt = chat.buildSystemPrompt('fr', '', { name: 'deep_case', compressionMode: 'expanded' });
for (const [label, text] of [['kb', kb], ['prompt', prompt]]) {
  // price grid 24.11: Pro dès 249, old 390/190/120/119, per-minute and "sur demande" gone
  for (const bad of [/\b119\b/, /\b(390|190|120) CHF/, /0,15/, /sur demande\b(?!")/i, /quand vous voulez/i, /prise de messages/i, /dix premiers/i, /sans (autre )?service externe/i, /100 ?% local/i]) {
    assert.ok(!bad.test(text), `${label} contains ${bad}`);
  }
  for (const good of ['79 CHF par mois', '149 CHF par mois', 'dès 249 CHF par mois', 'dès 490 CHF, puis 39 CHF par mois', 'dès 690 CHF, puis 29 CHF par mois', 'dès 990 CHF, puis 59 CHF par mois', 'dès 490 CHF, puis 79 CHF par mois', 'dès 490 CHF la demi-journée', "1'500 CHF", 'préavis 30 jours', 'Groq']) {
    assert.ok(text.includes(good), `${label} missing ${good}`);
  }
}
assert.ok(!/PDF/.test(kb), 'kb mentions PDF');
// audit G2: the prompt must forbid invented past clients
assert.ok(prompt.includes('CLIENTS RULE'), 'prompt missing CLIENTS RULE');
console.log('test-chat-offer: OK');

// 24.11: chat shows plain text and Enrico works alone (no ** and no "nous" verbs)
assert.strictEqual(chat.sanitizeReply('Nous proposons **La Ligne**.'), 'Je propose La Ligne.');
assert.strictEqual(chat.sanitizeReply('Ici nous installons tout.'), "Ici j'installe tout.");
assert.ok(fs.readFileSync(path.join(__dirname, '../serafino-kb/05-pricing.md'), 'utf8').includes("1'500 minutes"));
console.log('test-chat-sanitize: OK');
