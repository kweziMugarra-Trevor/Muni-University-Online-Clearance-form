const jwt = require("jsonwebtoken");
const db = require("../db");

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) return res.status(401).json({ error: "Please log in first." });
  try {
    const claims = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!Number.isSafeInteger(claims.id) || !claims.exp) throw new Error("Invalid token");
    const user = db.prepare(`SELECT u.id, u.role, u.university_id, u.department_id
      FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = ? AND (u.role != 'officer' OR d.university_id = u.university_id)`).get(claims.id);
    if (!user) throw new Error("Invalid user");
    req.user = { id: user.id, role: user.role, universityId: user.university_id, departmentId: user.department_id };
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "You are not allowed to do this." });
    next();
  };
}
module.exports = { auth, requireRole };
