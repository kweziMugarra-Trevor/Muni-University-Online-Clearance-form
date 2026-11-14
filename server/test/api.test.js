const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

// All test credentials and the SQLite database are temporary and never printed.
test("local initialization, API authorization, validation and clearance lifecycle", async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "clearance-test-"));
  const env = { ...process.env, DB_PATH: path.join(temp, "test.db"), JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    ADMIN_EMAIL: "admin@test.example", ADMIN_PASSWORD: crypto.randomBytes(16).toString("hex"), UNIVERSITY_NAME: "Test University" };
  delete env.ADMIN_NAME;
  const init = () => spawnSync(process.execPath, [path.join(__dirname, "../src/init-db.js")], { env, encoding: "utf8" });
  const bad = spawnSync(process.execPath, [path.join(__dirname, "../src/init-db.js")], { env: { ...env, ADMIN_PASSWORD: "" }, encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.equal(fs.existsSync(env.DB_PATH), false);
  assert.equal(init().status, 0);
  assert.equal(init().status, 0);
  Object.assign(process.env, env);
  const db = require("../src/db");
  const app = require("../src/server");
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, method = "GET", body, token) {
    const response = await fetch(base + route, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const unis = await request("/api/auth/universities");
  assert.equal(unis.status, 200);
  assert.equal(unis.data.length, 1);
  assert.equal((await request("/api/missing")).status, 404);
  assert.equal((await request("/api/admin/departments")).status, 401);
  assert.equal((await request("/api/auth/login", "POST", {email: {}, password: []})).status, 400);
  assert.equal((await request("/api/auth/register", "POST", {fullName:" ", email:"bad", password:"x", regNumber:"a", universityId:1})).status, 400);
  const malformed = await fetch(base + "/api/auth/login", {method:"POST", headers:{"content-type":"application/json"}, body:"{"});
  assert.equal(malformed.status, 400);
  const admin = await request("/api/auth/login", "POST", {email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD});
  assert.equal(admin.status, 200);
  const adminToken = admin.data.token;
  const studentInfo = {fullName:"Student A", email:"student@test.example", password:"student-password", regNumber:"REG-A", universityId:unis.data[0].id};
  assert.equal((await request("/api/auth/register", "POST", studentInfo)).status, 201);
  assert.equal((await request("/api/auth/register", "POST", studentInfo)).status, 409);
  const student = await request("/api/auth/login", "POST", studentInfo);
  assert.equal(student.status, 200);
  const st = student.data.token;
  assert.equal((await request("/api/admin/departments", "GET", undefined, st)).status, 403);
  assert.equal((await request("/api/clearance", "POST", {}, st)).status, 201);
  assert.equal((await request("/api/clearance", "POST", {}, st)).status, 409);
  assert.throws(() => db.prepare("INSERT INTO clearance_requests (student_id) VALUES (?)").run(student.data.user.id), /UNIQUE/);
  const departments = (await request("/api/admin/departments", "GET", undefined, adminToken)).data;
  assert.equal(departments.length, 7);
  const secondUni = db.prepare("INSERT INTO universities (name) VALUES ('Other')").run().lastInsertRowid;
  const otherDept = db.prepare("INSERT INTO departments (university_id, name) VALUES (?, 'Other')").run(secondUni).lastInsertRowid;
  assert.equal((await request("/api/admin/officers", "POST", {fullName:"Officer",email:"other@test.example",password:"password123", departmentId:otherDept}, adminToken)).status, 400);
  const officers = [];
  for (const dept of departments) {
    const info = {fullName:"Test Officer",email:`officer${dept.id}@test.example`,password:"officer-password",departmentId:dept.id};
    assert.equal((await request("/api/admin/officers", "POST", info, adminToken)).status, 201);
    const login = await request("/api/auth/login", "POST", info);
    assert.equal(login.status, 200);
    officers.push(login.data.token);
  }
  const queues = [];
  for (const token of officers) {
    const q = await request("/api/officer/queue", "GET", undefined, token);
    assert.equal(q.data.length, 1);
    queues.push(q.data[0]);
  }
  assert.equal((await request(`/api/officer/decide/${queues[0].approvalId}`, "POST", {decision:"approved"}, officers[1])).status, 404);
  assert.equal((await request(`/api/officer/decide/${queues[0].approvalId}`, "POST", {decision:"rejected", reason:{}}, officers[0])).status, 400);
  assert.equal((await request(`/api/officer/decide/${queues[0].approvalId}`, "POST", {decision:"rejected", reason:"Outstanding"}, officers[0])).status, 200);
  assert.equal((await request("/api/clearance/mine", "GET", undefined, st)).data.request.status, "rejected");
  for (let i = 0; i < officers.length; i++) {
    assert.equal((await request(`/api/officer/decide/${queues[i].approvalId}`, "POST", {decision:"approved"}, officers[i])).status, 200);
  }
  const cleared = (await request("/api/clearance/mine", "GET", undefined, st)).data.request;
  assert.equal(cleared.status, "cleared");
  assert.equal((await request(`/api/clearance/verify/${cleared.certificateCode}`)).data.valid, true);
  assert.equal((await request(`/api/officer/decide/${queues[0].approvalId}`, "POST", {decision:"rejected",reason:"change"}, officers[0])).status, 409);
  assert.equal((await request(`/api/clearance/verify/not-a-code`)).status, 404);
  db.prepare("UPDATE users SET role = 'student', department_id = NULL WHERE id = ?").run(require("jsonwebtoken").decode(officers[0]).id);
  assert.equal((await request("/api/officer/queue", "GET", undefined, officers[0])).status, 403);
  assert.equal((await request("/api/clearance", "POST", {}, st)).status, 201);
});
