-- ============================================================
-- ONLINE CLEARANCE SYSTEM - DATABASE SCHEMA (multi-university)
-- Written for SQLite. For PostgreSQL/MySQL change:
--   INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL / AUTO_INCREMENT
--   datetime('now') -> CURRENT_TIMESTAMP
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. Each university that uses the system
CREATE TABLE universities (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- 2. Offices that must approve a clearance (Library, Finance, ...)
CREATE TABLE departments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  UNIQUE (university_id, name),
  FOREIGN KEY (university_id) REFERENCES universities(id)
);

-- 3. All users: students, department officers and admins
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER NOT NULL,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                       -- never store plain passwords
  role          TEXT NOT NULL CHECK (role IN ('student', 'officer', 'admin')),
  reg_number    TEXT,                                -- students only
  department_id INTEGER,                             -- officers only
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (university_id, reg_number),
  FOREIGN KEY (university_id) REFERENCES universities(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 4. One clearance request per student
CREATE TABLE clearance_requests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'cleared', 'rejected')),
  certificate_code TEXT UNIQUE,                      -- used for the QR code once cleared
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT,
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- 5. One row per department per request (this gives parallel approvals)
CREATE TABLE clearance_approvals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id    INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reason        TEXT,                                -- e.g. "Unreturned library book"
  officer_id    INTEGER,                             -- who made the decision
  decided_at    TEXT,
  UNIQUE (request_id, department_id),
  FOREIGN KEY (request_id)    REFERENCES clearance_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (officer_id)    REFERENCES users(id)
);

-- 6. Uploaded files (payment receipts, passport photos)
CREATE TABLE uploads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL,
  file_type   TEXT NOT NULL CHECK (file_type IN ('receipt', 'photo', 'other')),
  file_path   TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES clearance_requests(id) ON DELETE CASCADE
);

-- 7. Audit trail: who did what and when
CREATE TABLE audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  action     TEXT NOT NULL,                          -- e.g. "APPROVED", "REJECTED", "LOGIN"
  details    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_approvals_dept_status ON clearance_approvals (department_id, status);
CREATE INDEX idx_requests_student      ON clearance_requests (student_id);
-- Prevent duplicate active requests even when multiple processes access SQLite.
CREATE UNIQUE INDEX idx_one_active_request ON clearance_requests (student_id) WHERE status != 'cleared';
