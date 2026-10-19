// Checks onboarding when e-mail delivery is NOT configured (no RESEND_API_KEY, no DEV_EMAIL_LOG).
// Needs a database that already has an admin (run the smoke test first), then restart `npm run cf:dev` with
// DEV_EMAIL_LOG removed from .dev.vars and run:  node scripts/no-email-test.mjs
const BASE = process.env.BASE_URL || "http://localhost:8788";
const run = Date.now().toString(36);
let pass = 0, fail = 0;
const ok = (c, name, extra = "") => { if (c) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); } };

class Client {
  constructor() { this.ck = new Map(); }
  async call(method, path, body) {
    const h = body !== undefined ? { "content-type": "application/json" } : {};
    if (this.ck.size) h.cookie = [...this.ck].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() || []) { const [pair] = c.split(";"); const i = pair.indexOf("="); this.ck.set(pair.slice(0, i), pair.slice(i + 1)); }
    const t = await res.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: res.status, data };
  }
  get(p) { return this.call("GET", p); }
  post(p, b = {}) { return this.call("POST", p, b); }
}

(async () => {
  const health = (await new Client().get("/api/health")).data;
  ok(health.secrets.email === false, "e-mail delivery is reported as NOT configured by /api/health", JSON.stringify(health.secrets));

  const admin = new Client();
  let r;
  for (const pw of ["Brand-New-Pass1", "Correct-Horse-9", process.env.ADMIN_PASSWORD].filter(Boolean)) {
    r = await admin.post("/api/auth/login", { email: process.env.ADMIN_EMAIL || "admin@example.com", password: pw });
    if (r.status === 200) break;
  }
  ok(r.status === 200 && r.data.user.role === "admin", "admin can sign in", JSON.stringify(r.data));

  r = await new Client().post("/api/auth/register", { email: `self-${run}@example.com`, password: "Correct-Horse-9" });
  ok(r.status === 503 && /not configured/i.test(r.data.error), "self-registration says clearly that e-mail is not available", JSON.stringify(r.data));

  const email = `partner-${run}@example.com`;
  r = await admin.post("/api/users/invite", { email, role: "user" });
  const temp = r.data.temporaryPassword;
  ok(r.status === 201 && r.data.emailSent === false && /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/.test(temp || ""), "invite falls back to a one-time temporary password", JSON.stringify(r.data));

  const partner = new Client();
  r = await partner.post("/api/auth/login", { email, password: temp });
  ok(r.status === 200, "the invited person signs in with it");
  r = await partner.get("/api/entities/Partner");
  ok(r.status === 403, "...but has no data access yet (not a partner, no approved request)");

  const created = await admin.post("/api/entities/Partner", { business_name: `No Email Salon ${run}`, user_id: r0(await partner.get("/api/auth/me")).id, status: "active", email, contact_person: "Nora" });
  ok(created.status === 201, "head office creates the partner linked to that login", JSON.stringify(created.data).slice(0, 100));
  r = await partner.get("/api/entities/Partner");
  ok(r.status === 200 && r.data.items.length === 1 && r.data.items[0].business_name.startsWith("No Email Salon"), "a partner-linked login is approved automatically and sees only its own partner row");
  r = await partner.get("/api/entities/Client");
  ok(r.status === 403, "and still cannot reach the clinic's internal data");

  r = await new Client().post("/api/auth/password-reset/request", { email });
  ok(r.status === 200, "forgot-password still answers uniformly when e-mail is unavailable");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

function r0(res) { return res.data; }
