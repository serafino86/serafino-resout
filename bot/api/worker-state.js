"use strict";

const { loadState, STATE_FILE } = require("../lib/task-store");

module.exports = async function handler(_req, res) {
  const state = loadState();
  return res.status(200).json({
    ok: true,
    state_file: STATE_FILE,
    knowledge_source: state.knowledge?.sourcePath || null,
    pipeline_source: state.knowledge?.pipelineSource || null,
    news_summary: state.news || null,
    state,
  });
};
