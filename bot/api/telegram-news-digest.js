"use strict";

const { sendNewsDigest } = require("../lib/telegram-bridge");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const chatId = body.chat_id || null;
  const mode = String(body.mode || "default").trim();

  try {
    const result = await sendNewsDigest(chatId, mode);
    return res.status(200).json({
      ok: true,
      mode,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Telegram send failed",
    });
  }
};
