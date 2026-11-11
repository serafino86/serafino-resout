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
  for (const bad of [/\bLigne\b/, /\b249\b/, /\b119\b/, /r[ée]servation/i, /prise de messages/i, /dix premiers/i]) {
    assert.ok(!bad.test(text), `${label} contains ${bad}`);
  }
  for (const good of ['390', '190', '120', '30']) assert.ok(text.includes(good), `${label} missing ${good}`);
}
assert.ok(!/PDF/.test(kb), 'kb mentions PDF');
console.log('test-chat-offer: OK');
