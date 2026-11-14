const crypto = require("crypto");
const express = require("express");
const db = require("../db");
const validate = require("../validation");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(auth, requireRole("officer"));

// Queue for MY office. ?status=pending (default) | approved | rejected
router.get("/queue", (req, res) => {
  const status = ["pending", "approved", "rejected"].includes(req.query.status)
    ? req.query.status
    : "pending";

  const rows = db
    .prepare(
      `SELECT a.id AS approvalId, a.status, a.reason, u.full_name AS studentName,
              u.reg_number AS regNumber, r.created_at AS requestedAt
       FROM clearance_approvals a
       JOIN clearance_requests r ON r.id = a.request_id
       JOIN users u ON u.id = r.student_id
       WHERE a.department_id = ? AND a.status = ?
       ORDER BY r.created_at`
    )
    .all(req.user.departmentId, status);

  res.json(rows);
});

// Approve or reject one student at my office
router.post("/decide/:approvalId", (req, res) => {
  const { decision, reason } = req.body || {};

  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'." });
  }
  if (!validate.id(req.params.approvalId) || (reason != null && (typeof reason !== "string" || reason.length > 1000))) {
    return res.status(400).json({ error: "Invalid approval or reason." });
  }
  if (decision === "rejected" && !validate.text(reason, 1000)) {
    return res.status(400).json({ error: "Please give a reason for rejecting." });
  }

  const approval = db
    .prepare("SELECT * FROM clearance_approvals WHERE id = ?")
    .get(req.params.approvalId);

  // An officer can only act on their own office's approvals
  if (!approval || approval.department_id !== req.user.departmentId) {
    return res.status(404).json({ error: "Approval not found for your office." });
  }
  const request = db.prepare("SELECT status FROM clearance_requests WHERE id = ?").get(approval.request_id);
  if (!request || request.status === "cleared") {
    return res.status(409).json({ error: "Completed requests cannot be changed." });
  }

  const save = db.transaction(() => {
    db.prepare(
      `UPDATE clearance_approvals
       SET status = ?, reason = ?, officer_id = ?, decided_at = datetime('now')
       WHERE id = ?`
    ).run(decision, decision === "rejected" ? reason.trim() : null, req.user.id, approval.id);

    db.prepare("INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)").run(
      req.user.id,
      decision.toUpperCase(),
      `approval ${approval.id}, request ${approval.request_id}`
    );

    // Work out the overall status of the request
    const all = db
      .prepare("SELECT status FROM clearance_approvals WHERE request_id = ?")
      .all(approval.request_id);

    if (all.some((a) => a.status === "rejected")) {
      db.prepare("UPDATE clearance_requests SET status = 'rejected', completed_at = NULL WHERE id = ?")
        .run(approval.request_id);
    } else if (all.every((a) => a.status === "approved")) {
      db.prepare(
        `UPDATE clearance_requests
         SET status = 'cleared', completed_at = datetime('now'),
             certificate_code = COALESCE(certificate_code, ?)
         WHERE id = ?`
      ).run(crypto.randomUUID(), approval.request_id);
    } else {
      db.prepare("UPDATE clearance_requests SET status = 'in_progress', completed_at = NULL WHERE id = ?")
        .run(approval.request_id);
    }
  });

  save();
  res.json({ message: `Marked as ${decision}.` });
});

module.exports = router;
