"use strict";

const { execFile, spawn } = require("node:child_process");

const OPENROUTER_MODEL_FALLBACK = "nvidia/nemotron-3-super-120b-a12b:free";
const { executeContract } = require("./local-executor");
const { resolveRoutePolicy } = require("./route-policy");
const { ingestPlannedTask } = require("./worker-engine");

function buildOpenClawMessages(plan) {
  return [
    {
      role: "user",
      content: [
        "Sei OpenClaw, esecutore operativo per Enrico.",
        "Leggi il contratto qui sotto e rispondi in italiano con SOLO la risposta finale per Telegram.",
        "Non mostrare JSON, tool call, bash, ragionamento interno o metadati.",
        "Se un'azione esterna richiede conferma, prepara la bozza/riepilogo e chiedi conferma.",
        "",
        "CONTRATTO:",
        plan.openclaw_prompt,
      ].join("\n"),
    },
  ];
}

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

function spawnJsonCommand(command, args, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Command exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Invalid JSON from bridge: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function spawnTextCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Command exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function extractOpenClawTranscriptReply(container, marker) {
  const script = `
import glob, json, os, sys

marker = sys.argv[1]
files = sorted(
    glob.glob("/data/.openclaw/agents/main/sessions/*.jsonl"),
    key=os.path.getmtime,
    reverse=True,
)[:30]

def content_text(message, include_thinking=False):
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    texts = []
    if isinstance(content, list):
        for item in content:
            if not isinstance(item, dict):
                continue
            typ = item.get("type")
            if typ == "text":
                texts.append(str(item.get("text") or ""))
            elif include_thinking and typ == "thinking":
                texts.append(str(item.get("thinking") or ""))
    return "\\n".join(t.strip() for t in texts if t.strip()).strip()

for path in files:
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except OSError:
        continue

    marker_index = -1
    for idx, line in enumerate(lines):
        try:
            event = json.loads(line)
        except Exception:
            continue
        message = event.get("message") or {}
        if event.get("type") == "message" and message.get("role") == "user":
            if marker in content_text(message, include_thinking=True):
                marker_index = idx

    if marker_index < 0:
        continue

    for line in lines[marker_index + 1:]:
        try:
            event = json.loads(line)
        except Exception:
            continue
        message = event.get("message") or {}
        if event.get("type") != "message" or message.get("role") != "assistant":
            continue
        text = content_text(message)
        if text:
            print(text)
            raise SystemExit(0)

print("")
`;

  const result = await spawnTextCommand("docker", [
    "exec",
    container,
    "python3",
    "-c",
    script,
    marker,
  ]);
  return result.stdout.trim();
}

function isLeadEnrichmentRequest(plan, context) {
  const text = `${context.message || ""} ${plan.primary_intent || ""} ${plan.intents?.join(" ") || ""}`.toLowerCase();
  return /arricch|enrich|email|telefono|contatt/i.test(text);
}

async function callOpenClawLeadScripts(plan, context) {
  const container = String(process.env.OPENCLAW_DOCKER_CONTAINER || "openclaw-yddr-openclaw-1").trim();
  const commands = [
    "set -e",
    "PIPELINE_RESULT=$(bash /data/.openclaw/workspace/scripts/node-pipeline-trigger.sh 2>&1 || true)",
  ];

  if (isLeadEnrichmentRequest(plan, context)) {
    commands.push("ENRICH_RESULT=$(bash /data/.openclaw/workspace/scripts/run-enrich-task.sh 2>&1 || true)");
  } else {
    commands.push("ENRICH_RESULT='SKIPPED'");
  }

  commands.push("printf 'PIPELINE:%s\\nENRICH:%s\\n' \"$PIPELINE_RESULT\" \"$ENRICH_RESULT\"");

  const result = await spawnTextCommand("docker", [
    "exec",
    container,
    "bash",
    "-lc",
    commands.join("\n"),
  ]);

  const output = result.stdout.trim();
  const pipeline = (output.match(/^PIPELINE:(.*)$/m) || [])[1] || "";
  const enrich = (output.match(/^ENRICH:(.*)$/m) || [])[1] || "";
  const parts = [];

  if (pipeline.startsWith("NOTIFY:")) {
    parts.push(pipeline.replace(/^NOTIFY:/, ""));
  } else if (pipeline === "SILENT") {
    parts.push("Pipeline non rilanciata: c'è già lavoro in corso, coda attiva o risorse non disponibili.");
  } else if (pipeline) {
    parts.push(`Pipeline: ${pipeline}`);
  }

  if (enrich && enrich !== "SKIPPED") {
    if (enrich === "EMPTY") {
      parts.push("Arricchimento: nessun lead pending in enrich-queue.");
    } else if (enrich.startsWith("DONE:")) {
      parts.push(`Arricchimento completato: ${enrich.replace(/^DONE:/, "")}`);
    } else if (enrich.startsWith("NONE:")) {
      parts.push(`Arricchimento tentato, email non trovata: ${enrich.replace(/^NONE:/, "")}`);
    } else {
      parts.push(`Arricchimento: ${enrich}`);
    }
  }

  return {
    mode: "forwarded-openclaw",
    target: "openclaw",
    reply: normalizeOpenClawReply(parts.join("\n") || "Lead task avviato dentro OpenClaw.", plan),
    forwarded: true,
    raw: {
      stdout: result.stdout,
      stderr: result.stderr,
    },
    source: context.source || "unknown",
    bridge: "docker-exec-openclaw-scripts",
  };
}

async function callOpenClawChatBridge(plan, context) {
  const container = String(process.env.OPENCLAW_DOCKER_CONTAINER || "openclaw-yddr-openclaw-1").trim();
  const token = String(process.env.OPENCLAW_GATEWAY_TOKEN || "").trim();
  const payload = {
    model: String(process.env.OPENCLAW_GATEWAY_MODEL || "openclaw").trim(),
    messages: buildOpenClawMessages(plan),
    temperature: 0.2,
    max_tokens: Math.max(64, plan.max_tokens || 420),
    stream: false,
  };

  const startedAt = Date.now();
  const shellScript = [
    "set -euo pipefail",
    "payload=$(mktemp)",
    "cat > \"$payload\"",
    `curl -sS --max-time 90 -X POST http://127.0.0.1:18789/v1/chat/completions -H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' --data-binary @\"$payload\"`,
    "rm -f \"$payload\"",
  ].join("\n");

  const data = await spawnJsonCommand(
    "docker",
    ["exec", "-i", container, "sh", "-lc", shellScript],
    payload,
  );
  const rawReply = String(data?.choices?.[0]?.message?.content || "");
  const reply = normalizeOpenClawReply(rawReply, plan);

  return {
    mode: "forwarded-openclaw",
    target: "openclaw",
    reply,
    forwarded: true,
    raw: {
      duration_ms: Date.now() - startedAt,
      data,
      raw_reply: rawReply,
    },
    source: context.source || "unknown",
    bridge: "docker-exec-openclaw-chat",
  };
}

async function callOpenClawDockerBridge(plan, context) {
  if (plan.route === "lead_capture") {
    return callOpenClawLeadScripts(plan, context);
  }

  return callOpenClawChatBridge(plan, context);
}

function normalizeOpenClawReply(rawReply, plan) {
  const reply = String(rawReply || "").trim();
  if (
    !reply
    || /^no response from openclaw\.?$/i.test(reply)
    || /^longleftrightarrow/i.test(reply)
    || /^ONTALERT:/i.test(reply)
    || reply.includes('{"name"')
    || reply.includes('{"name": "browser"')
    || reply.includes('"arguments"')
  ) {
    if (plan.route === "personal_email") {
      return "Ho classificato la richiesta come email personale. OpenClaw deve preparare la bozza usando Gmail personale e chiederti conferma prima di inviare.";
    }
    if (plan.route === "calendar_event") {
      return "Ho classificato la richiesta come evento calendario. OpenClaw deve preparare il riepilogo e chiederti conferma prima di crearlo.";
    }
    if (plan.route === "contact_save") {
      return "Ho classificato la richiesta come contatto personale. OpenClaw deve preparare la scheda e chiederti conferma prima di salvarla.";
    }
    if (plan.route === "personal_memory") {
      return "Ho classificato la richiesta come pensiero personale. OpenClaw deve preparare la nota fuori dal CRM e chiederti conferma prima di salvarla.";
    }
    return "Ho preso in carico la richiesta, ma OpenClaw non ha restituito una risposta pulita. La tengo in sospeso invece di inventare.";
  }
  return reply;
}

async function callOpenClawGateway(plan, context) {
  const baseUrl = String(process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:53160").trim().replace(/\/+$/, "");
  const token = String(process.env.OPENCLAW_GATEWAY_TOKEN || "").trim();
  const model = String(process.env.OPENCLAW_GATEWAY_MODEL || "openclaw").trim();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const payload = {
    model,
    messages: buildOpenClawMessages(plan),
    temperature: 0.2,
    max_tokens: Math.max(64, plan.max_tokens || 420),
    stream: false,
  };
  const data = await postJson(`${baseUrl}/v1/chat/completions`, payload, headers);
  return {
    mode: "forwarded-openclaw",
    target: "openclaw",
    reply: String(data?.choices?.[0]?.message?.content || "").trim() || null,
    forwarded: true,
    model,
    raw: data,
    source: context.source || "unknown",
  };
}

async function dispatchToOpenClaw(plan, context) {
  const endpoint = process.env.OPENCLAW_EXECUTOR_URL;
  if (String(process.env.OPENCLAW_DOCKER_BRIDGE_ENABLED || "").trim().toLowerCase() === "on") {
    return callOpenClawDockerBridge(plan, context);
  }
  if (String(process.env.OPENCLAW_GATEWAY_ENABLED || "").trim().toLowerCase() === "on") {
    return callOpenClawGateway(plan, context);
  }
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
  const workerLoopMode = String(process.env.WORKER_LOOP_MODE || "").trim().toLowerCase() === "on";
  const allowWorkerQueue = context.allowWorkerQueue !== false;
  const forceExecution = context.forceExecution === true;

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

  if (workerLoopMode && allowWorkerQueue && !forceExecution) {
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

  if (policy !== "active" && !forceExecution) {
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
