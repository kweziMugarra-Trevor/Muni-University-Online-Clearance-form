const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const validate = require("../validation");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(auth, requireRole("admin"));

// Offices of my university
router.get("/departments", (req, res) => {
  res.json(
    db.prepare("SELECT id, name, description FROM departments WHERE university_id = ? ORDER BY name")
      .all(req.user.universityId)
  );
});

// Add an office
router.post("/departments", (req, res) => {
  const { name, description } = req.body || {};
  if (!validate.text(name, 150) || (description != null && (typeof description !== "string" || description.length > 1000)))
    return res.status(400).json({ error: "Provide a valid office name and description." });

  try {
    const info = db
      .prepare("INSERT INTO departments (university_id, name, description) VALUES (?, ?, ?)")
      .run(req.user.universityId, name.trim(), description || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "That office already exists." });
    }
    throw err;
  }
});

// Create an officer account for an office
router.post("/officers", (req, res) => {
  const { fullName, email, password, departmentId } = req.body || {};
  if (!validate.text(fullName, 150) || !validate.email(email) || !validate.password(password) || !validate.id(departmentId)) {
    return res.status(400).json({ error: "Provide valid fields and a password of at least 8 characters and at most 72 UTF-8 bytes." });
  }

  const dept = db
    .prepare("SELECT id FROM departments WHERE id = ? AND university_id = ?")
    .get(departmentId, req.user.universityId);
  if (!dept) return res.status(400).json({ error: "Choose an office from your university." });

  try {
    db.prepare(
      `INSERT INTO users (university_id, full_name, email, password_hash, role, department_id)
       VALUES (?, ?, ?, ?, 'officer', ?)`
    ).run(req.user.universityId, fullName.trim(), email.trim().toLowerCase(),
          bcrypt.hashSync(password, 10), dept.id);
    res.status(201).json({ message: "Officer account created." });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "That email is already registered." });
    }
    throw err;
  }
});

// Overview of all requests at my university
router.get("/requests", (req, res) => {
  res.json(
    db.prepare(
      `SELECT r.id, r.status, r.created_at AS createdAt, r.completed_at AS completedAt,
              u.full_name AS studentName, u.reg_number AS regNumber
       FROM clearance_requests r JOIN users u ON u.id = r.student_id
       WHERE u.university_id = ? ORDER BY r.id DESC`
    ).all(req.user.universityId)
  );
});

module.exports = router;
