const express = require("express");
const db = require("../db");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// PUBLIC: verify a certificate (this is what the QR code will open)
router.get("/verify/:code", (req, res) => {
  const row = db
    .prepare(
      `SELECT u.full_name, u.reg_number, uni.name AS university, r.completed_at
       FROM clearance_requests r
       JOIN users u ON u.id = r.student_id
       JOIN universities uni ON uni.id = u.university_id
       WHERE r.certificate_code = ? AND r.status = 'cleared'`
    )
    .get(req.params.code);

  if (!row) return res.status(404).json({ valid: false });
  res.json({ valid: true, ...row });
});

// STUDENT: start a clearance request. Every office receives it at the same time.
router.post("/", auth, requireRole("student"), (req, res) => {
  const active = db
    .prepare("SELECT id FROM clearance_requests WHERE student_id = ? AND status != 'cleared'")
    .get(req.user.id);
  if (active) {
    return res.status(409).json({ error: "You already have an active clearance request." });
  }

  const offices = db
    .prepare("SELECT id FROM departments WHERE university_id = ?")
    .all(req.user.universityId);
  if (offices.length === 0) {
    return res.status(400).json({ error: "Your university has no clearance offices set up yet." });
  }

  const create = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO clearance_requests (student_id) VALUES (?)")
      .run(req.user.id);
    const addApproval = db.prepare(
      "INSERT INTO clearance_approvals (request_id, department_id) VALUES (?, ?)"
    );
    offices.forEach((o) => addApproval.run(info.lastInsertRowid, o.id));
    db.prepare("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'REQUEST_CREATED', ?)")
      .run(req.user.id, `request ${info.lastInsertRowid}`);
    return info.lastInsertRowid;
  });

  try {
    res.status(201).json({ requestId: create() });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "You already have an active clearance request." });
    throw err;
  }
});

// STUDENT: see my request and the status at every office
router.get("/mine", auth, requireRole("student"), (req, res) => {
  const request = db
    .prepare(
      `SELECT id, status, certificate_code AS certificateCode, created_at AS createdAt,
              completed_at AS completedAt
       FROM clearance_requests WHERE student_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(req.user.id);

  if (!request) return res.json({ request: null });

  const approvals = db
    .prepare(
      `SELECT d.name AS department, a.status, a.reason, a.decided_at AS decidedAt
       FROM clearance_approvals a JOIN departments d ON d.id = a.department_id
       WHERE a.request_id = ? ORDER BY d.name`
    )
    .all(request.id);

  res.json({ request, approvals });
});

module.exports = router;
