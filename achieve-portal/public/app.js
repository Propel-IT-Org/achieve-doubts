// The pretend Achieve session: the student's details, kept for this tab only.
const STORAGE_KEY = "achieve-portal:student";
const FIELDS = ["name", "email", "phone", "institution", "batch", "accessCode"];

const ERRORS = {
  WRONG_ACCESS_CODE: "That portal access code is wrong.",
  PORTAL_NOT_CONFIGURED:
    "The portal is missing DOUBTS_API_URL, ACHIEVE_SHARED_SECRET or PORTAL_ACCESS_CODE. The worker log names which.",
  API_UNREACHABLE: "The Doubts API couldn't be reached.",
  BAD_REDIRECT: "The Doubts API sent back an unexpected redirect.",
  BLOCKED_BEFORE_API:
    "Something in front of the API refused the request (Cloudflare or the reverse proxy) — it never reached Doubts. Check the worker logs for the response it returned.",
  INVALID_PAYLOAD: "Doubts rejected the details: a field is missing or malformed.",
  INVALID_AUTH: "Doubts rejected the shared secret.",
  IP_NOT_ALLOWED:
    "Doubts refused this portal's IP. Clear ACHIEVE_ALLOWED_IPS on the backend to test from a worker.",
  UNKNOWN_BATCH: "That batch doesn't exist or isn't active in Doubts.",
  RATE_LIMITED: "Too many sign-ins right now. Try again in a minute.",
  INTERNAL_ERROR: "Doubts hit an internal error.",
};

function readStudent() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function writeStudent(student) {
  try {
    if (student) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(student));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the page still works until it reloads.
  }
}

let current = readStudent();

function render() {
  const signedIn = Boolean(current);
  document.getElementById("sign-in").hidden = signedIn;
  document.getElementById("dashboard").hidden = !signedIn;
  document.getElementById("sign-out").hidden = !signedIn;
  if (!signedIn) return;

  document.getElementById("student-name").textContent = current.name;

  const details = document.getElementById("student-details");
  details.replaceChildren();
  for (const [label, key] of [
    ["Email", "email"],
    ["Phone", "phone"],
    ["Institution", "institution"],
    ["Batch", "batch"],
  ]) {
    if (!current[key]) continue;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = current[key];
    details.append(dt, dd);
  }

  const form = document.getElementById("doubt-solve-form");
  for (const name of FIELDS) form.elements[name].value = current[name] ?? "";
}

function showError() {
  const code = new URLSearchParams(location.search).get("error");
  if (!code) return;
  const el = document.getElementById("error");
  el.textContent = ERRORS[code] ?? `Sign-in to Doubts failed (${code}).`;
  el.hidden = false;
  history.replaceState(null, "", location.pathname);
}

document.getElementById("sign-in-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  current = Object.fromEntries(FIELDS.map((name) => [name, String(data.get(name) ?? "").trim()]));
  writeStudent(current);
  render();
});

document.getElementById("sign-out").addEventListener("click", () => {
  current = null;
  writeStudent(null);
  render();
});

document.getElementById("doubt-solve-form").addEventListener("submit", (event) => {
  // Stop double submits: each press mints a new one-time token.
  event.submitter?.setAttribute("disabled", "");
});

showError();
render();
