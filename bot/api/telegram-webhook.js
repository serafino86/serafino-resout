"use strict";

const { handleTelegramUpdate } = require("../lib/telegram-bridge");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const update = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  try {
    const result = await handleTelegramUpdate(update);
    return res.status(200).json({
      ok: true,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Telegram webhook failed",
    });
  }
};
