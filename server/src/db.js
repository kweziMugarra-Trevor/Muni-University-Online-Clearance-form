const path = require("path");
const Database = require("better-sqlite3");

// Override only for isolated testing or a deliberate local database location.
const filename = process.env.DB_PATH || path.join(__dirname, "..", "clearance.db");
const db = new Database(filename);
db.pragma("foreign_keys = ON");
module.exports = db;
