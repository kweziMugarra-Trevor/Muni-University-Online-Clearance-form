// Shared helpers used by every page
const API = new URL("api", document.baseURI).href.replace(/\/$/, "");
const HOMES = { student: "student.html", officer: "officer.html", admin: "admin.html" };

function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem("session"));
    return session && typeof session.token === "string" && session.token &&
      session.user && Object.hasOwn(HOMES, session.user.role) ? session : null;
  } catch { return null; }
}
function saveSession(session) { localStorage.setItem("session", JSON.stringify(session)); }
function logout() { localStorage.removeItem("session"); location.href = "index.html"; }

function homeFor(role) { return HOMES[role] || "index.html"; }

// Sends the request with the login token and returns the JSON, or throws an Error with the server's message
async function api(path, { method = "GET", body } = {}) {
  const session = getSession();
  const headers = { "Content-Type": "application/json" };
  if (session && session.token) headers.Authorization = "Bearer " + session.token;

  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  let data;
  try { data = await res.json(); } catch {
    throw new Error("The server returned an unexpected response. Check that the Express server is running.");
  }

  if (res.status === 401 && session && !path.startsWith("/auth/")) { logout(); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}). Please try again.`);
  return data;
}

// Page guard: sends the visitor to the login page unless they have the right role
function requireRole(role) {
  const session = getSession();
  if (!session) { location.replace("index.html"); return null; }
  if (session.user.role !== role) { location.replace(homeFor(session.user.role)); return null; }
  return session;
}

// Escape text before putting it into HTML (stops injected scripts)
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function badge(status) {
  return `<span class="badge ${esc(status)}">${esc(String(status).replace("_", " "))}</span>`;
}

function fmtDate(value) {
  if (!value) return "";
  const text = String(value).trim().replace(" ", "T");
  const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(text) ? text : text + "Z");
  return isNaN(d) ? value : d.toLocaleString();
}

function showMsg(el, text, type = "error") {
  el.textContent = text;
  el.className = "msg show " + type;
}

// Draws the top bar with the user's name and a logout button
function mountTopbar() {
  const session = getSession();
  document.getElementById("topbar").innerHTML = `
    <div class="inner">
      <a class="brand" href="${esc(session ? homeFor(session.user.role) : "index.html")}">Online Clearance System</a>
      <div class="who">
        <span>${session ? esc(session.user.fullName) : ""}</span>
        ${session ? '<button class="secondary small" id="logout-btn">Log out</button>' : ""}
      </div>
    </div>`;
  const btn = document.getElementById("logout-btn");
  if (btn) btn.addEventListener("click", logout);
}
