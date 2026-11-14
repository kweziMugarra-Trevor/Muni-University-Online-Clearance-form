const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const validate = require("../validation");

const router = express.Router();

// Public list for the registration dropdown
router.get("/universities", (req, res) => {
  res.json(db.prepare("SELECT id, name FROM universities ORDER BY name").all());
});

// Student self-registration
router.post("/register", (req, res) => {
  const { fullName, email, password, regNumber, universityId } = req.body || {};

  if (!validate.text(fullName, 150) || !validate.email(email) || !validate.password(password) ||
      !validate.text(regNumber, 100) || !validate.id(universityId)) {
    return res.status(400).json({ error: "Provide valid fields and a password of at least 8 characters and at most 72 UTF-8 bytes." });
  }

  const uni = db.prepare("SELECT id FROM universities WHERE id = ?").get(universityId);
  if (!uni) return res.status(400).json({ error: "Choose a valid university." });

  try {
    db.prepare(
      `INSERT INTO users (university_id, full_name, email, password_hash, role, reg_number)
       VALUES (?, ?, ?, ?, 'student', ?)`
    ).run(
      uni.id,
      fullName.trim(),
      email.trim().toLowerCase(),
      bcrypt.hashSync(password, 10),
      regNumber.trim()
    );
    res.status(201).json({ message: "Account created. You can now log in." });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res
        .status(409)
        .json({ error: "That email or registration number is already registered." });
    }
    throw err;
  }
});

// Login for students, officers and admins
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!validate.email(email) || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72 || !password) {
    return res.status(400).json({ error: "Valid email and password are required." });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      universityId: user.university_id,
      departmentId: user.department_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  db.prepare("INSERT INTO audit_logs (user_id, action) VALUES (?, 'LOGIN')").run(user.id);

  res.json({
    token,
    user: { id: user.id, fullName: user.full_name, role: user.role, regNumber: user.reg_number },
  });
});

module.exports = router;
