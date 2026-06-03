"use strict";

const OPENROUTER_MODEL_FALLBACK = "nvidia/nemotron-3-super-120b-a12b:free";
const { executeContract } = require("./local-executor");
const { resolveRoutePolicy } = require("./route-policy");
const { ingestPlannedTask } = require("./worker-engine");

function workerReply(context, mode, task) {
  const language = String(context.language || "fr").trim();
  if (mode === "worker-blocked") {
    if (language === "it") return "Questa azione risulta già coperta nel CRM o già completata. Non rilancio una ricerca duplicata.";
    if (language === "en") return "This action already appears covered in the CRM or already done. I am not relaunching a duplicate search.";
    if (language === "de-CH") return "Diese Aktion scheint im CRM bereits vorhanden oder schon erledigt zu sein. Ich starte keine doppelte Suche.";
    return "Cette action semble déjà couverte dans le CRM ou déjà faite. Je ne relance pas une recherche en doublon.";
  }

  const intent = task?.primary_intent || "task";
  if (language === "it") return `Preso in carico subito. Priorità alta su ${intent}; il lavoro automatico è stato sospeso e riprenderà dopo.`;
  if (language === "en") return `Taken immediately. High priority on ${intent}; background work has been suspended and will resume after.`;
  if (language === "de-CH") return `Direkt übernommen. Hohe Priorität auf ${intent}; die Hintergrundarbeit wurde pausiert und läuft danach weiter.`;
  return `Pris en charge tout de suite. Priorité haute sur ${intent} ; le travail automatique est suspendu et reprendra ensuite.`;
}

function buildHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(headers),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }
  return data;
}

async function dispatchToOpenClaw(plan, context) {
  const endpoint = process.env.OPENCLAW_EXECUTOR_URL;
  if (!endpoint) {
    try {
      const result = await executeContract({
        prompt: plan.openclaw_prompt,
        model_profile: plan.model_profile,
        max_tokens: plan.max_tokens,
      });
      return {
        mode: "forwarded-local-executor",
        target: "openclaw",
        reply: result.reply,
        forwarded: true,
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      return {
        mode: "planned-only",
        target: "openclaw",
        reply: null,
        forwarded: false,
        error: error instanceof Error ? error.message : "Local executor failed",
      };
    }
  }

  const payload = {
    route: plan.route,
    compression_mode: plan.compression_mode,
    prompt: plan.openclaw_prompt,
    user_message: context.message,
    memory: context.memory || "",
    language: context.language,
  };

  const headers = {};
  if (process.env.OPENCLAW_EXECUTOR_TOKEN) {
    headers.Authorization = `Bearer ${process.env.OPENCLAW_EXECUTOR_TOKEN}`;
  }

  const data = await postJson(endpoint, payload, headers);
  return {
    mode: "forwarded-openclaw",
    target: "openclaw",
    reply: typeof data.reply === "string" ? data.reply : null,
    forwarded: true,
    raw: data,
  };
}

async function dispatchToNemotron(plan) {
  try {
    const result = await executeContract({
      prompt: plan.openclaw_prompt,
      model_profile: "nemotron",
      max_tokens: Math.max(256, plan.max_tokens || 650),
    });

    return {
      mode: "forwarded-nemotron",
      target: "nemotron",
      reply: result.reply || null,
      forwarded: true,
      provider: result.provider,
      model: result.model,
    };
  } catch (error) {
    return {
      mode: "planned-only",
      target: "nemotron",
      reply: null,
      forwarded: false,
      error: error instanceof Error ? error.message : "Nemotron executor failed",
    };
  }
}

async function dispatchExecution(plan, context) {
  const policy = resolveRoutePolicy(plan.route);

  if (policy === "disabled") {
    return {
      mode: "disabled",
      target: plan.executor,
      reply: null,
      forwarded: false,
      policy,
    };
  }

  if (plan.executor === "direct") {
    return {
      mode: "direct",
      target: "direct",
      reply: context.directReply || null,
      forwarded: false,
      policy,
    };
  }

  if (String(process.env.WORKER_LOOP_MODE || "").trim().toLowerCase() === "on") {
    const queued = ingestPlannedTask(plan, {
      message: context.message,
      language: context.language,
      source: "chat",
      priority: 100,
    });
    return {
      mode: queued.duplicate ? "worker-blocked" : "worker-queued",
      target: "worker",
      reply: workerReply(context, queued.duplicate ? "worker-blocked" : "worker-queued", queued.task),
      forwarded: false,
      policy,
      task: queued.task,
      suspended_task: queued.suspended || null,
      duplicate: queued.duplicate,
    };
  }

  if (policy !== "active") {
    return {
      mode: "planned-only",
      target: plan.executor,
      reply: null,
      forwarded: false,
      policy,
    };
  }

  if (plan.model_profile === "nemotron") {
    return dispatchToNemotron(plan, context);
  }

  return dispatchToOpenClaw(plan, context);
}

module.exports = {
  dispatchExecution,
};
