"use strict";

require("../lib/load-env").loadEnv(require("node:path").resolve(__dirname, ".."));

const checks = [
  ["CRM_DATA_PATH", process.env.CRM_DATA_PATH],
  ["CRM_PIPELINE_STATE_PATH", process.env.CRM_PIPELINE_STATE_PATH],
  ["CRM_DASHBOARD_URL", process.env.CRM_DASHBOARD_URL],
  ["TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN],
  ["TELEGRAM_DEFAULT_CHAT_ID", process.env.TELEGRAM_DEFAULT_CHAT_ID],
];

const result = checks.map(([key, value]) => ({
  key,
  configured: Boolean(String(value || "").trim()),
}));

const ok = result.every((item) => item.configured);

console.log(JSON.stringify({
  ok,
  checks: result,
  mode: String(process.env.NEWS_DIGEST_MODE || "default").trim() || "default",
  workerLoopMode: String(process.env.WORKER_LOOP_MODE || "off").trim().toLowerCase(),
}, null, 2));

process.exit(ok ? 0 : 1);
