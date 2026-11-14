// Run once: npm run init-db. Safe to rerun; never changes an existing password.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { text, email, password } = require("./validation");
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME || "System Admin";
const uniName = process.env.UNIVERSITY_NAME || "Sample University";
if (!email(adminEmail) || !password(adminPassword, 12) || !text(adminName, 150) || !text(uniName, 150)) {
  console.error("Set a valid ADMIN_EMAIL and a unique ADMIN_PASSWORD (12–72 UTF-8 bytes) in server/.env before initialization.");
  process.exit(1);
}
const db = require("./db");
const schema = fs.readFileSync(path.join(__dirname, "..", "..", "database", "schema.sql"), "utf8");
const offices = [
  ["Library", "Books returned and no fines"], ["Finance", "Tuition and fees fully paid"],
  ["Accommodation", "Hall room handed over, no damages"], ["Sports", "Sports equipment returned"],
  ["Health Unit", "No outstanding medical records or fees"], ["Security", "ID card returned, no cases pending"],
  ["Registry", "Final academic records check"]
];
try {
  db.transaction(() => {
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!existing) db.exec(schema);
    // Existing databases with duplicate active requests require manual cleanup first.
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_request ON clearance_requests (student_id) WHERE status != 'cleared'");
    let uni = db.prepare("SELECT id FROM universities WHERE name = ?").get(uniName.trim());
    if (!uni) {
      uni = { id: db.prepare("INSERT INTO universities (name) VALUES (?)").run(uniName.trim()).lastInsertRowid };
      const add = db.prepare("INSERT INTO departments (university_id, name, description) VALUES (?, ?, ?)");
      offices.forEach(([name, desc]) => add.run(uni.id, name, desc));
    }
    const admin = db.prepare("SELECT id, role, university_id FROM users WHERE email = ?").get(adminEmail.trim().toLowerCase());
    if (admin && (admin.role !== "admin" || admin.university_id !== uni.id)) throw new Error("Admin email belongs to another account.");
    if (!admin) db.prepare("INSERT INTO users (university_id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')")
      .run(uni.id, adminName.trim(), adminEmail.trim().toLowerCase(), bcrypt.hashSync(adminPassword, 10));
  })();
  console.log("Database initialized. Existing accounts and passwords are unchanged.");
} catch (err) {
  console.error("Database initialization failed:", err.message);
  process.exitCode = 1;
} finally { db.close(); }
