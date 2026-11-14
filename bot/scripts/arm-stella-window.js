'use strict';

// Run on the VPS only after the email has actually been sent.
const fs = require('node:fs');
const path = require('node:path');

const sentAt = process.argv[2];
const arm = process.argv[3] === '--arm';
if (!sentAt || !/(Z|[+-]\d{2}:\d{2})$/.test(sentAt) || (process.argv[3] && !arm)) {
  console.error('Usage: node arm-stella-window.js <sent-at-ISO-with-timezone> [--arm]');
  process.exit(2);
}
const sentMs = Date.parse(sentAt);
if (!Number.isFinite(sentMs)) { console.error('Invalid send timestamp'); process.exit(2); }
const expiresAt = new Date(sentMs + 10 * 24 * 60 * 60 * 1000).toISOString();
if (!arm) {
  console.log(JSON.stringify({ sentAt: new Date(sentMs).toISOString(), expiresAt, armed: false }));
  process.exit(0);
}
if (sentMs > Date.now() + 5 * 60_000 || sentMs < Date.now() - 48 * 60 * 60_000) {
  console.error('Send timestamp must be from an email sent in the last 48 hours');
  process.exit(2);
}
const file = process.env.STELLA_HOST_EXPIRY_FILE || '/var/lib/serafino-bot/data/stella-expiry.txt';
if (fs.existsSync(file)) { console.error('Expiry is already armed; inspect it before changing anything'); process.exit(2); }
const temporary = `${file}.new-${process.pid}`;
try {
  fs.writeFileSync(temporary, `${expiresAt}\n`, { flag: 'wx', mode: 0o644 });
  fs.renameSync(temporary, file);
} catch (error) {
  try { fs.unlinkSync(temporary); } catch (_) {}
  console.error(`Could not arm expiry: ${error.message}`);
  process.exit(1);
}
console.log(JSON.stringify({ sentAt: new Date(sentMs).toISOString(), expiresAt, armed: true, file }));
