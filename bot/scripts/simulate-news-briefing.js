"use strict";

const { ingestNewsItems, buildNewsBriefing, saveNewsState } = require("../lib/news-store");
const { formatTelegramBriefing } = require("../lib/news-filter");
const newsAction = require("../api/news-action");

saveNewsState({ items: [], updated_at: null, last_briefing_at: null });

ingestNewsItems([
  {
    title: "New GGUF release improves 7B local inference on consumer GPUs",
    snippet: "A new quantized release targets 8 GB consumer GPU setups with better local inference.",
    url: "https://example.com/news/local-gguf",
    source: "Example AI",
    published_at: "2026-04-20T08:00:00Z",
  },
  {
    title: "Agent framework ships better tool calling for multi-step workflow automation",
    snippet: "The update focuses on orchestration, tool calling and workflow automation.",
    url: "https://example.com/news/agent-tools",
    source: "Automation Weekly",
    published_at: "2026-04-20T09:00:00Z",
  },
  {
    title: "Academic benchmark on a 671B research model",
    snippet: "A theoretical analysis with benchmark only and no practical local inference angle.",
    url: "https://example.com/news/benchmark-noise",
    source: "Research Journal",
    published_at: "2026-04-20T10:00:00Z",
  },
]);

console.log(JSON.stringify(buildNewsBriefing(), null, 2));
console.log("\n--- TELEGRAM ---\n");
console.log(formatTelegramBriefing(buildNewsBriefing().briefing, { crmUrl: "https://crm.example.com/news" }));

(async () => {
  const out = await new Promise((resolve) => {
    const req = { method: "GET", query: { action: "B" }, body: {} };
    const res = { status(code) { this.code = code; return this; }, json(payload) { resolve(payload); } };
    process.env.CRM_DASHBOARD_URL = "https://crm.example.com/news";
    newsAction(req, res);
  });
  console.log("\n--- ACTION B ---\n");
  console.log(out.text);
})();
