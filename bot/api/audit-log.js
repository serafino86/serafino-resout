"use strict";

const { AUDIT_FILE, readRecentAuditEvents } = require("../lib/audit-log");

module.exports = async function handler(req, res) {
  const limit = Number.parseInt(req.query?.limit || "100", 10);
  return res.status(200).json({
    ok: true,
    audit_file: AUDIT_FILE,
    events: readRecentAuditEvents(limit),
  });
};
