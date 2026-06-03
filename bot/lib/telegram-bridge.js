"use strict";

const { buildNewsBriefing } = require("./news-store");
const { formatTelegramBriefing } = require("./news-filter");
const { resolveNewsAction } = require("./news-actions");

function getTelegramConfig() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    defaultChatId: String(process.env.TELEGRAM_DEFAULT_CHAT_ID || "").trim(),
    crmUrl: String(process.env.CRM_DASHBOARD_URL || "").trim(),
  };
}

function telegramApiUrl(method, token) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function telegramRequest(method, payload, fetchImpl = fetch) {
  const { token } = getTelegramConfig();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN non configurato.");
  }

  const response = await fetchImpl(telegramApiUrl(method, token), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram HTTP ${response.status}`);
  }
  return data;
}

function buildNewsKeyboard(crmUrl) {
  return {
    inline_keyboard: [
      [
        crmUrl
          ? { text: "A · Apri CRM", url: crmUrl }
          : { text: "A · Apri CRM", callback_data: "news:A" },
        { text: "B · Modelli", callback_data: "news:B" },
      ],
      [
        { text: "C · Business", callback_data: "news:C" },
        { text: "D · Testare", callback_data: "news:D" },
      ],
      [
        { text: "E · Ignora oggi", callback_data: "news:E" },
      ],
    ],
  };
}

function buildTelegramNewsDigest(mode = "default") {
  const { crmUrl } = getTelegramConfig();
  const { briefing } = buildNewsBriefing();
  return {
    text: formatTelegramBriefing(briefing, { mode, crmUrl }),
    reply_markup: buildNewsKeyboard(crmUrl),
  };
}

async function sendTelegramMessage(chatId, text, options = {}, fetchImpl = fetch) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
  }, fetchImpl);
}

async function answerCallbackQuery(callbackQueryId, text, fetchImpl = fetch) {
  return telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  }, fetchImpl);
}

async function sendNewsDigest(chatId, mode = "default", fetchImpl = fetch) {
  const { defaultChatId } = getTelegramConfig();
  const targetChatId = String(chatId || defaultChatId || "").trim();
  if (!targetChatId) {
    throw new Error("TELEGRAM_DEFAULT_CHAT_ID non configurato.");
  }
  const digest = buildTelegramNewsDigest(mode);
  return sendTelegramMessage(targetChatId, digest.text, {
    reply_markup: digest.reply_markup,
  }, fetchImpl);
}

function extractNewsAction(update) {
  const callbackData = update?.callback_query?.data;
  if (typeof callbackData === "string" && callbackData.startsWith("news:")) {
    return callbackData.split(":")[1] || "";
  }

  const text = String(update?.message?.text || "").trim().toUpperCase();
  if (/^[ABCDE]$/.test(text)) return text;
  return "";
}

function extractChatId(update) {
  const callbackChatId = update?.callback_query?.message?.chat?.id;
  const messageChatId = update?.message?.chat?.id;
  return callbackChatId || messageChatId || null;
}

async function handleTelegramUpdate(update, fetchImpl = fetch) {
  const action = extractNewsAction(update);
  if (!action) {
    return {
      ok: true,
      ignored: true,
      reason: "No news action detected",
    };
  }

  const result = resolveNewsAction(action);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  const chatId = extractChatId(update);
  if (!chatId) {
    return {
      ok: false,
      error: "Missing chat id",
    };
  }

  if (update?.callback_query?.id) {
    await answerCallbackQuery(update.callback_query.id, `Azione ${action} ricevuta.`, fetchImpl);
  }

  const options = result.mode === "open_crm"
    ? { disable_web_page_preview: true }
    : { reply_markup: buildNewsKeyboard(getTelegramConfig().crmUrl) };

  const sent = await sendTelegramMessage(chatId, result.text, options, fetchImpl);
  return {
    ok: true,
    action,
    result,
    sent,
  };
}

module.exports = {
  getTelegramConfig,
  buildNewsKeyboard,
  buildTelegramNewsDigest,
  sendNewsDigest,
  handleTelegramUpdate,
};
