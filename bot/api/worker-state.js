"use strict";

const { loadState, STATE_FILE } = require("../lib/task-store");
const { summarizeWorkerState } = require("../lib/worker-summary");
const { workWindowStatus } = require("../lib/work-window");

module.exports = async function handler(_req, res) {
  const state = loadState();
  const summary = summarizeWorkerState(state);
  const workWindow = workWindowStatus();
  return res.status(200).json({
    ok: true,
    work_window: workWindow,
    state_file: STATE_FILE,
    knowledge_source: state.knowledge?.sourcePath || null,
    pipeline_source: state.knowledge?.pipelineSource || null,
    news_summary: state.news || null,
    summary,
    state,
  });
};
