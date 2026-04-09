module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    nodeEnv: process.env.NODE_ENV || null,
  });
};
