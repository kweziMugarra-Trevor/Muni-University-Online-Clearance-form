require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Set JWT_SECRET to a private random value of at least 32 characters in server/.env.");
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
// In-memory limits are only a local-demo guard, not distributed protection.
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth/register", rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clearance", require("./routes/clearance"));
app.use("/api/officer", require("./routes/officer"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api", (req, res) => res.status(404).json({ error: "API route not found." }));
app.use(express.static(path.join(__dirname, "..", "..", "client"), { dotfiles: "deny" }));
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
  console.error("Request failed; see server configuration and database state.");
  res.status(500).json({ error: "Something went wrong on the server." });
});
if (require.main === module) {
  const db = require("./db");
  const tables = ["universities", "departments", "users", "clearance_requests", "clearance_approvals", "audit_logs"];
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
  const index = db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_one_active_request'").get();
  if (!tables.every(name => table.get(name)) || !index) {
    console.error("Database is not initialized or needs its index. Run npm run init-db before starting.");
    db.close();
    process.exit(1);
  }
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "127.0.0.1";
  app.listen(port, host, () => console.log(`Clearance system listening on ${host}:${port}`));
}
module.exports = app;
