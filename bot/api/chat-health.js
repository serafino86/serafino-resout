module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    workerLoopMode: String(process.env.WORKER_LOOP_MODE || "off").trim().toLowerCase() === "on",
    crmDashboardUrl: String(process.env.CRM_DASHBOARD_URL || "").trim() || null,
    nodeEnv: process.env.NODE_ENV || null,
  });
};
