'use strict';

require('./lib/load-env').loadEnv(__dirname);

const express = require('express');
const path    = require('node:path');
const WebSocket = require('ws');
const { handleRelayMessage } = require('./api/relay-reservation');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ── API routes ───────────────────────────────────────────────────────────────
app.post('/api/chat',        require('./api/chat'));
app.get( '/api/chat-health', require('./api/chat-health'));
app.post('/api/route',       require('./api/route'));
app.post('/api/dispatch',    require('./api/dispatch'));
app.post('/api/leadgen/plan', require('./api/leadgen-plan'));
app.post('/api/executor/openclaw', require('./api/executor-openclaw'));
app.get( '/api/shadow-log',  require('./api/shadow-log'));
app.get( '/api/shadow-summary', require('./api/shadow-summary'));
app.get( '/api/worker/state', require('./api/worker-state'));
app.post('/api/worker/heartbeat', require('./api/worker-heartbeat'));
app.post('/api/worker/chat-task', require('./api/worker-chat-task'));
app.post('/api/worker/complete', require('./api/worker-complete'));
app.get( '/api/audit-log', require('./api/audit-log'));
app.get( '/api/news/state', require('./api/news-state'));
app.get( '/api/news/briefing', require('./api/news-briefing'));
app.get( '/api/news/telegram', require('./api/news-telegram'));
app.get( '/api/news/action', require('./api/news-action'));
app.post('/api/news/action', require('./api/news-action'));
app.post('/api/news/ingest', require('./api/news-ingest'));
app.post('/api/news/collect', require('./api/news-collect'));
app.post('/api/telegram/news-digest', require('./api/telegram-news-digest'));
app.post('/api/telegram/webhook', require('./api/telegram-webhook'));

// ── Static files ─────────────────────────────────────────────────────────────
const ROOT = __dirname;
app.use(express.static(ROOT));

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(ROOT, 'bot.html')));

// ── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅  Serafino Bot avviato`);
  console.log(`   Locale:  http://localhost:${PORT}`);
  console.log(`   Rete LAN: http://<IP-SERVER>:${PORT}\n`);
});

// ── ConversationRelay WebSocket ───────────────────────────────────────────────
const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws/relay/reservation') {
    wss.handleUpgrade(req, socket, head, ws => {
      console.log('[relay] WebSocket connected');
      ws.on('message', raw => handleRelayMessage(ws, raw));
      ws.on('close', () => console.log('[relay] WebSocket closed'));
    });
  } else {
    socket.destroy();
  }
});
