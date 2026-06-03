"use strict";

const { executeContract } = require("../lib/local-executor");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  try {
    const result = await executeContract({
      prompt: body.prompt,
      model_profile: body.model_profile,
      max_tokens: body.max_tokens,
    });
    return res.status(200).json({
      ok: true,
      provider: result.provider,
      model: result.model,
      reply: result.reply,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Executor failed";
    return res.status(500).json({
      ok: false,
      error: errorMessage,
    });
  }
};
