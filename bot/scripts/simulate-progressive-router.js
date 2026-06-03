"use strict";

require("dotenv").config({ path: require("node:path").resolve(__dirname, "..", ".env.production") });

const dispatch = require("../api/dispatch");

const turns = [
  { message: "Test hertbreth", language: "it" },
  { message: "Ciao", language: "it" },
  { message: "Quanti lead abbiamo in pipeline?", language: "it" },
  { message: "Cerca 5 lead nuovi per hotel boutique a Lugano", language: "it" },
  { message: "Arricchisci i lead trovando email e sito web", language: "it" },
  { message: "Prepara una bozza email per il lead piu caldo", language: "it" },
  { message: "Test heartbeat", language: "it" },
  { message: "Ho un ristorante con team piccolo e caos sulle richieste clienti", language: "it" },
  { message: "Quanto costa e come funziona la garanzia?", language: "it" },
  { message: "Fai autodiagnosi e dimmi se c e qualcosa bloccato", language: "it" },
];

function call(body) {
  return new Promise((resolve) => {
    const req = { method: "POST", body };
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(payload) {
        resolve({ code: this.code || 200, payload });
      },
    };
    dispatch(req, res);
  });
}

(async () => {
  let memory = "";
  let messages = [];
  const out = [];

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    const result = await call({ ...turn, memory, messages });
    const p = result.payload;
    out.push({
      n: i + 1,
      message: turn.message,
      route: p.route,
      intents: p.intents || [],
      secondary_intents: p.secondaryIntents || p.secondary_intents || [],
      dispatch_mode: p.dispatch?.mode,
      target: p.dispatch?.target,
      model_profile: p.execution_plan?.model_profile,
      compression_mode: p.execution_plan?.compression_mode,
      tools_allowed: String(p.execution_plan?.openclaw_prompt || "").includes("TOOLS_ALLOWED: yes"),
      kb_files: p.execution_plan?.kb_files?.length || 0,
      error: p.dispatch?.error || p.error || null,
    });

    messages = [...messages, { role: "user", text: turn.message }];
    if (p.reply) messages.push({ role: "assistant", text: p.reply });
  }

  console.log(JSON.stringify(out, null, 2));
})();
