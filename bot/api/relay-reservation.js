'use strict';

const { extractSlots, nextQuestion } = require('../lib/reservation-slots');

// sessions: CallSid → { name, party, day, time, phase, from }
const sessions = new Map();

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function handleRelayMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  console.log(`[relay] msg type=${msg.type} raw=${raw.toString().slice(0, 200)}`);

  switch (msg.type) {
    case 'setup':
      sessions.set(msg.callSid, { phase: 'greeting', from: msg.from || '' });
      send(ws, {
        type: 'text',
        token: 'Bienvenue chez Serafino ! Quel est votre prénom ?',
        last: true,
      });
      console.log(`[relay] setup callSid=${msg.callSid} from=${msg.from}`);
      break;

    case 'prompt': {
      const session = sessions.get(msg.callSid);
      if (!session) return;
      const text = (msg.voicePrompt || '').trim();
      if (!text) return;
      console.log(`[relay] prompt callSid=${msg.callSid} text=${JSON.stringify(text)}`);
      processUtterance(ws, msg.callSid, session, text);
      break;
    }

    case 'interrupt':
      // caller ha interrotto — Twilio smette di parlare automaticamente
      console.log(`[relay] interrupt callSid=${msg.callSid}`);
      break;

    case 'end':
      sessions.delete(msg.callSid);
      console.log(`[relay] end callSid=${msg.callSid}`);
      break;

    default:
      break;
  }
}

async function processUtterance(ws, callSid, session, text) {
  const updated = await extractSlots(session, text);
  sessions.set(callSid, updated);

  const reply = nextQuestion(updated);
  console.log(`[relay] phase=${updated.phase} reply=${JSON.stringify(reply)}`);
  send(ws, { type: 'text', token: reply, last: true });

  if (updated.phase === 'done') {
    await saveReservation(callSid, updated);
    sessions.delete(callSid);
  }
}

async function saveReservation(callSid, session) {
  const token = process.env.CENTRALINA_ADMIN_TOKEN || '';
  const url   = process.env.CENTRALINA_API_URL || 'http://127.0.0.1:8094';

  try {
    const resp = await fetch(`${url}/api/reservation/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name:         session.name  || '',
        party:        session.party || 0,
        day:          session.day   || '',
        time:         session.time  || '',
        caller_phone: session.from  || '',
      }),
    });
    const d = await resp.json();
    if (d.ok) {
      console.log(`[relay] saved reservation request_id=${d.request_id} callSid=${callSid}`);
    } else {
      console.error(`[relay] save failed callSid=${callSid}`, d);
    }
  } catch (err) {
    console.error(`[relay] save error callSid=${callSid}:`, err.message);
  }
}

module.exports = { handleRelayMessage };
