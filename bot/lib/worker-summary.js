"use strict";

function summarizeWorkerState(state = {}) {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const byStatus = {};
  const byRole = {};
  const blocked = [];
  for (const task of tasks) {
    const status = task.status || "unknown";
    const role = task.agent_role || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;
    byRole[role] = (byRole[role] || 0) + 1;
    if (status === "blocked" || status === "failed") blocked.push(task);
  }

  const active = tasks.find((task) => task.id === state.currentTaskId) || null;
  const next = tasks
    .filter((task) => task.status === "queued" || task.status === "suspended")
    .sort((a, b) => String(a.updated_at || a.created_at).localeCompare(String(b.updated_at || b.created_at)))
    .slice(0, 8)
    .map(compactTask);

  return {
    cycle_count: state.cycleCount || 0,
    heartbeat_cursor: state.heartbeatCursor || 0,
    active_task: active ? compactTask(active) : null,
    next_tasks: next,
    blocked_tasks: blocked.slice(-8).map(compactTask),
    counts: {
      total: tasks.length,
      by_status: byStatus,
      by_role: byRole,
    },
    news: state.news || null,
    knowledge: {
      crm_records: state.knowledge?.records || 0,
      crm_keys: Array.isArray(state.knowledge?.crmKeys) ? state.knowledge.crmKeys.length : 0,
      done_keys: Array.isArray(state.knowledge?.doneKeys) ? state.knowledge.doneKeys.length : 0,
      running_keys: Array.isArray(state.knowledge?.runningKeys) ? state.knowledge.runningKeys.length : 0,
    },
  };
}

function compactTask(task) {
  return {
    id: task.id,
    role: task.agent_role,
    route: task.route,
    intent: task.primary_intent,
    status: task.status,
    step: `${task.current_step || 0}/${Array.isArray(task.steps) ? task.steps.length : 0}`,
    message: task.message,
    updated_at: task.updated_at,
  };
}

module.exports = {
  summarizeWorkerState,
};
