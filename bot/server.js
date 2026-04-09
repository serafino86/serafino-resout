'use strict';

require('dotenv').config({ path: '.env' });

const express = require('express');
const path    = require('node:path');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ── API routes ───────────────────────────────────────────────────────────────
app.post('/api/chat',        require('./api/chat'));
app.get( '/api/chat-health', require('./api/chat-health'));

// ── Static files ─────────────────────────────────────────────────────────────
const ROOT = __dirname;
app.use(express.static(ROOT));

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(ROOT, 'bot.html')));

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  Serafino Bot avviato`);
  console.log(`   Locale:  http://localhost:${PORT}`);
  console.log(`   Rete LAN: http://<IP-SERVER>:${PORT}\n`);
});
