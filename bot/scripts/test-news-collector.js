"use strict";

const { parseFeed } = require("../lib/news-collector");

const sample = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Local GGUF update for 7B models</title>
    <link>https://example.com/local-gguf</link>
    <description>Quantized local inference news for consumer GPU setups.</description>
    <pubDate>Mon, 20 Apr 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>New agent framework adds tool calling</title>
    <link>https://example.com/agent-tools</link>
    <description>Workflow orchestration and automation improvements.</description>
    <pubDate>Mon, 20 Apr 2026 11:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

console.log(JSON.stringify(parseFeed(sample, {
  id: "sample",
  label: "Sample Feed",
  group: "tests",
}), null, 2));
