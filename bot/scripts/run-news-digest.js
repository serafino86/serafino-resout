"use strict";

require("../lib/load-env").loadEnv(require("node:path").resolve(__dirname, ".."));

const { collectNews } = require("../lib/news-collector");
const { ingestNewsItems, buildNewsBriefing } = require("../lib/news-store");
const { formatTelegramBriefing } = require("../lib/news-filter");
const { sendNewsDigest } = require("../lib/telegram-bridge");

async function main() {
  const mode = String(process.env.NEWS_DIGEST_MODE || "default").trim();
  const chatId = String(process.env.TELEGRAM_DEFAULT_CHAT_ID || "").trim() || null;
  const crmUrl = String(process.env.CRM_DASHBOARD_URL || "").trim();

  const collection = await collectNews();
  const { added } = ingestNewsItems(collection.items);
  const { briefing, state } = buildNewsBriefing();
  const telegramText = formatTelegramBriefing(briefing, { mode, crmUrl });

  let sent = null;
  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    sent = await sendNewsDigest(chatId, mode);
  }

  console.log(JSON.stringify({
    collected_at: collection.collected_at,
    source_count: collection.sources.length,
    item_count: collection.items.length,
    added_count: added.length,
    errors: collection.errors,
    updated_at: state.updated_at,
    mode,
    sent: Boolean(sent),
    telegram_preview: telegramText,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
