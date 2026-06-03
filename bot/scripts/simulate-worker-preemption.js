"use strict";

const { ingestChatTask, runHeartbeatCycle, markTaskDone } = require("../lib/worker-engine");
const { analyzeRoute } = require("../lib/progressive-router");
const { loadState, saveState } = require("../lib/task-store");

function resetState() {
  saveState({
    tasks: [],
    currentTaskId: null,
    currentForegroundTaskId: null,
    heartbeatCursor: 0,
    cycleCount: 0,
    knowledge: {
      crmKeys: ["target:hotel lugano"],
      doneKeys: ["cycle:email_draft"],
    },
  });
}

function snapshot(label) {
  const state = loadState();
  return {
    label,
    currentTaskId: state.currentTaskId,
    currentForegroundTaskId: state.currentForegroundTaskId,
    tasks: state.tasks.map((task) => ({
      id: task.id,
      route: task.route,
      source: task.source,
      primary_intent: task.primary_intent,
      status: task.status,
      current_step: task.current_step,
      dedupe_keys: task.dedupe_keys,
      message: task.message,
    })),
  };
}

function main() {
  resetState();
  const out = [];

  out.push(snapshot("reset"));
  out.push(runHeartbeatCycle({ language: "it" }).state);
  out.push(snapshot("after-heartbeat-1"));

  const analysis = analyzeRoute("Scrivi email al lead piu caldo e aggiorna il CRM", []);
  ingestChatTask({ message: "Scrivi email al lead piu caldo e aggiorna il CRM", language: "it", analysis });
  out.push(snapshot("after-chat-preemption"));

  const state = loadState();
  const running = state.tasks.find((task) => task.status === "running" && task.source === "chat");
  if (running) markTaskDone(running.id, ["intent:email_draft"]);
  out.push(snapshot("after-chat-complete"));

  runHeartbeatCycle({ language: "it" });
  out.push(snapshot("after-heartbeat-2"));

  console.log(JSON.stringify(out, null, 2));
}

main();
