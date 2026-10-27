"use strict";

const { executeContract } = require("./local-executor");
const { buildNewsBriefing, savePreparedBriefing } = require("./news-store");

function compactSnippet(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 450);
}

function buildNemotronNewsPrompt(items) {
  const blocks = items.map((item, index) => [
    `${index + 1}. ${item.title}`,
    `FONTE: ${item.source || "sconosciuta"}`,
    `URL: ${item.url || "nessun url"}`,
    `TESTO: ${compactSnippet(item.snippet)}`,
    `CATEGORIE: ${(item.categories || []).join(", ") || "nessuna"}`,
  ].join("\n"));

  return [
    "RUOLO: Nemotron comprime a fine ciclo la rassegna IA gia' raccolta da OpenClaw.",
    "OBIETTIVO: riassumere in italiano dati gia' presenti, senza ragionamento operativo libero.",
    "",
    "REGOLE:",
    "- Non inventare notizie, dettagli, numeri o fonti.",
    "- Usa solo NEWS_ITEMS.",
    "- Scrivi in italiano semplice.",
    "- Massimo 12 righe.",
    "- Non decidere nuove azioni.",
    "- Non usare tool.",
    "- Non proporre strategie.",
    "- Se una notizia e' debole, segnala solo: poco rilevante.",
    "",
    "OUTPUT:",
    "Rassegna IA aggiornata",
    "1. [titolo] - [riassunto breve]",
    "2. [titolo] - [riassunto breve]",
    "3. [titolo] - [riassunto breve]",
    "Nota: [solo eventuale indicazione di poco rilevante, se serve]",
    "",
    "NEWS_ITEMS:",
    blocks.length ? blocks.join("\n\n") : "- nessuna notizia utile",
  ].join("\n");
}

async function prepareNewsWithNemotron(options = {}) {
  const limit = Math.max(3, Number(options.limit || 8));
  const { briefing } = buildNewsBriefing();
  const items = Array.isArray(briefing?.summary?.top) ? briefing.summary.top.slice(0, limit) : [];
  const prompt = buildNemotronNewsPrompt(items);
  const result = await executeContract({
    prompt,
    model_profile: "nemotron",
    max_tokens: 2600,
  });
  const fallbackText = [
    "Rassegna IA aggiornata",
    ...items.slice(0, 3).map((item, index) => `${index + 1}. ${item.title} - ${compactSnippet(item.snippet) || "notizia raccolta dalla fonte."}`),
    items.length ? "Nota: sintesi deterministica usata perche' Nemotron non ha restituito testo." : "Nota: nessuna notizia utile trovata nel ciclo.",
  ].join("\n");

  return savePreparedBriefing({
    text: String(result.reply || "").trim() || fallbackText,
    provider: result.provider,
    model: result.model,
    source_item_ids: items.map((item) => item.id).filter(Boolean),
  });
}

module.exports = {
  prepareNewsWithNemotron,
  buildNemotronNewsPrompt,
};
