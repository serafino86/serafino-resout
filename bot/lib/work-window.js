"use strict";

function parseHour(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(23, parsed));
}

function romeHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Number.parseInt(parts.find((part) => part.type === "hour")?.value || "0", 10);
}

function isWorkWindowOpen(date = new Date(), env = process.env) {
  const start = parseHour(env.WORK_WINDOW_START_HOUR, 9);
  const stop = parseHour(env.WORK_WINDOW_STOP_HOUR, 20);
  const hour = romeHour(date);

  if (start === stop) return true;
  if (start < stop) return hour >= start && hour < stop;
  return hour >= start || hour < stop;
}

function workWindowStatus(date = new Date(), env = process.env) {
  const start = parseHour(env.WORK_WINDOW_START_HOUR, 9);
  const stop = parseHour(env.WORK_WINDOW_STOP_HOUR, 20);
  const open = isWorkWindowOpen(date, env);
  return {
    open,
    timezone: "Europe/Rome",
    current_hour: romeHour(date),
    start_hour: start,
    stop_hour: stop,
    message: open
      ? `Lavoro automatico attivo fino alle ${String(stop).padStart(2, "0")}:00.`
      : `Lavoro automatico sospeso. Riprende alle ${String(start).padStart(2, "0")}:00.`,
  };
}

module.exports = {
  isWorkWindowOpen,
  workWindowStatus,
};
