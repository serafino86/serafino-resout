"use strict";

const { collectNews } = require("../lib/news-collector");
const { ingestNewsItems, buildNewsBriefing } = require("../lib/news-store");
const { formatTelegramBriefing } = require("../lib/news-filter");

(async () => {
  const collection = await collectNews();
  const { added } = ingestNewsItems(collection.items);
  const { briefing } = buildNewsBriefing();

  console.log(JSON.stringify({
    collected_at: collection.collected_at,
    source_count: collection.sources.length,
    item_count: collection.items.length,
    added_count: added.length,
    errors: collection.errors,
    telegram_text: formatTelegramBriefing(briefing),
  }, null, 2));
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
