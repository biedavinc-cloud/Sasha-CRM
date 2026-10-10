// End-to-end smoke test against a local `wrangler pages dev` (see README-CLOUDFLARE.md).
//   WRANGLER_LOG=/tmp/wrangler.log node scripts/smoke-test.mjs
// Emails are logged by the dev server (no RESEND_API_KEY), so OTP codes / reset links are read from that log.
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:8788";
const LOG = process.env.WRANGLER_LOG || "/tmp/wrangler.log";
const ADMIN = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
const run = Date.now().toString(36);
let pass = 0, fail = 0;

const ok = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); }
};

class Client {
  constructor() { this.cookie = ""; }
  async call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (/Max-Age=0/i.test(c) || v === "") this.cookie = this.cookie.split("; ").filter((x) => !x.startsWith(k + "=")).join("; ");
      else this.cookie = [...this.cookie.split("; ").filter((x) => x && !x.startsWith(k + "=")), pair].join("; ");
    }
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  get(p) { return this.call("GET", p); }
  post(p, b = {}) { return this.call("POST", p, b); }
  patch(p, b) { return this.call("PATCH", p, b); }
  del(p) { return this.call("DELETE", p); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function lastMail(to, re) {
  await sleep(250);
  const log = fs.readFileSync(LOG, "utf8");
  const blocks = log.split("[email:dev]").filter((b) => b.includes(`to=${to} `));
  for (const b of blocks.reverse()) { const m = re.exec(b); if (m) return m[1]; }
  return null;
}
const otpFor = (e) => lastMail(e, /verification code is (\d{6})/);
const resetTokenFor = (e) => lastMail(e, /token=([A-Za-z0-9_%-]+)/);

async function registerAndVerify(c, email, password) {
  const r = await c.post("/api/auth/register", { email, password });
  if (r.status !== 200) return r;
  const code = await otpFor(email);
  return c.post("/api/auth/verify-otp", { email, otpCode: code });
}

(async () => {
  const user = new Client(), admin = new Client(), other = new Client();
  const anonClient = () => new Client();
  const anon = anonClient(); // used only for requests that must stay logged out
  const uEmail = `user-${run}@example.com`, oEmail = `other-${run}@example.com`, pw = "Correct-Horse-9";

  console.log("\n== Registration & email verification ==");
  let r = await anon.post("/api/auth/register", { email: uEmail, password: "short" });
  ok(r.status === 400, "rejects password < 8 chars", JSON.stringify(r.data));
  r = await user.post("/api/auth/register", { email: uEmail, password: pw });
  ok(r.status === 200, "register ok");
  r = await user.post("/api/auth/verify-otp", { email: uEmail, otpCode: "000000" });
  ok(r.status === 400, "wrong OTP rejected");
  r = await user.get("/api/auth/me");
  ok(r.status === 401, "no session before verification");
  r = await user.post("/api/auth/login", { email: uEmail, password: pw });
  ok(r.status === 403 && r.data.code === "verification_required", "login before verification -> verification_required");
  const code = await otpFor(uEmail);
  ok(/^\d{6}$/.test(code || ""), "OTP email sent (6 digits)");
  r = await user.post("/api/auth/verify-otp", { email: uEmail, otpCode: code });
  ok(r.status === 200 && r.data.user.role === "user", "correct OTP -> session, role=user", JSON.stringify(r.data));
  r = await user.post("/api/auth/verify-otp", { email: uEmail, otpCode: code });
  ok(r.status === 400, "OTP is single-use");
  r = await user.get("/api/auth/me");
  ok(r.status === 200 && r.data.email === uEmail, "/me returns the user");
  ok(!JSON.stringify(r.data).includes("password"), "/me leaks no password data");

  console.log("\n== Login ==");
  r = await anon.post("/api/auth/login", { email: uEmail, password: "wrong-password" });
  const wrongPw = r;
  r = await anon.post("/api/auth/login", { email: `nobody-${run}@example.com`, password: "whatever123" });
  ok(wrongPw.status === 401 && r.status === 401 && wrongPw.data.error === r.data.error, "wrong password and unknown email give the same error");
  const lc = new Client();
  r = await lc.post("/api/auth/login", { email: uEmail, password: pw });
  ok(r.status === 200 && /sid=/.test(lc.cookie), "login sets session cookie");
  const setCookie = (await new Client().call("POST", "/api/auth/login", { email: uEmail, password: pw })).headers.get("set-cookie") || "";
  ok(/HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie), "cookie is HttpOnly + SameSite=Lax");

  console.log("\n== Admin bootstrap ==");
  r = await registerAndVerify(admin, ADMIN, pw);
  if (r.status !== 200) { r = await admin.post("/api/auth/login", { email: ADMIN, password: pw }); }
  ok(r.status === 200 && r.data.user.role === "admin", "ADMIN_EMAILS account becomes admin after verifying email", JSON.stringify(r.data));
  r = await registerAndVerify(other, oEmail, pw);
  ok(r.status === 200 && r.data.user.role === "user", "other account is a normal user");

  console.log("\n== Server-side approval gate & privilege escalation ==");
  r = await user.get("/api/entities/Partner");
  ok(r.status === 403, "unapproved user cannot read data (403)", JSON.stringify(r.data));
  r = await user.post("/api/entities/AccessRequest", { user_id: "someone-else", user_email: "x@y.z", status: "approved", requested_role: "admin", phone: "+971500000000" });
  ok(r.status === 201 && r.data.status === "pending" && r.data.user_id !== "someone-else" && r.data.requested_role === "user", "access request forced to pending/own id", JSON.stringify(r.data));
  const reqId = r.data.id;
  r = await user.patch(`/api/entities/AccessRequest/${reqId}`, { status: "approved" });
  ok(r.status === 403, "user cannot approve own request");
  r = await user.get("/api/users");
  ok(r.status === 403, "user cannot list users");
  const me = (await user.get("/api/auth/me")).data;
  r = await user.patch(`/api/users/${me.id}`, { role: "admin" });
  ok(r.status === 403, "user cannot make themselves admin");
  r = await anon.get("/api/entities/Partner");
  ok(r.status === 401, "anonymous cannot read entities");
  r = await user.post("/api/entities/Partner", { business_name: "Evil" });
  ok(r.status === 403, "user cannot create partners");

  console.log("\n== Admin approves user (Users page flow) ==");
  r = await admin.get("/api/users");
  ok(r.status === 200 && r.data.items.some((u) => u.email === uEmail) && !JSON.stringify(r.data).includes("password"), "admin lists users (no hashes)");
  r = await admin.get('/api/entities/AccessRequest?q=' + encodeURIComponent(JSON.stringify({ status: "pending" })));
  ok(r.status === 200 && r.data.items.some((x) => x.id === reqId), "admin sees pending request");
  r = await admin.patch(`/api/users/${me.id}`, { role: "user" });
  ok(r.status === 200, "admin updates user role");
  r = await admin.patch(`/api/entities/AccessRequest/${reqId}`, { status: "approved", reviewed_by: ADMIN });
  ok(r.status === 200 && r.data.status === "approved", "admin approves request");
  r = await other.post("/api/entities/AccessRequest", { phone: "+971500000001" });
  await admin.patch(`/api/entities/AccessRequest/${r.data.id}`, { status: "approved" });
  r = await user.get("/api/entities/Partner");
  ok(r.status === 200, "approved user can now reach data", JSON.stringify(r.data));
  const adminMe = (await admin.get("/api/auth/me")).data;
  r = await admin.patch(`/api/users/${adminMe.id}`, { role: "user" });
  ok(r.status === 400, "admin cannot demote self");

  console.log("\n== Entities, RLS, queries ==");
  const oMe = (await other.get("/api/auth/me")).data;
  const mk = async (name, uid, code) => (await admin.post("/api/entities/Partner", { business_name: name, user_id: uid, referral_code: code, status: "active", contact_person: name })).data;
  const p1 = await mk("Salon One", me.id, `ONE${run}`);
  const p2 = await mk("Salon Two", oMe.id, `TWO${run}`);
  ok(p1.status === "active" && p1.commission_percentage === 10 && p1.id, "create applies schema defaults");
  r = await user.get("/api/entities/Partner");
  ok(r.data.items.length === 1 && r.data.items[0].id === p1.id, "partner sees ONLY their own Partner (RLS)", JSON.stringify(r.data.items?.map((x) => x.business_name)));
  r = await user.get(`/api/entities/Partner/${p2.id}`);
  ok(r.status === 404, "partner cannot read another partner by id");
  r = await user.patch(`/api/entities/Partner/${p1.id}`, { commission_percentage: 99 });
  ok(r.status === 403, "partner cannot edit own Partner row directly");
  r = await user.get("/api/entities/Partner?q=" + encodeURIComponent(JSON.stringify({ user_id: oMe.id })));
  ok(r.status === 200 && r.data.items.length === 0, "filtering for someone else's rows yields nothing");
  r = await admin.get("/api/entities/Partner?sort=-created_date&limit=10");
  ok(r.data.items.length >= 2 && r.data.items[0].id === p2.id, "admin sorts by -created_date");
  r = await admin.get("/api/entities/Partner/count?q=" + encodeURIComponent(JSON.stringify({ status: { $in: ["active", "pending"] } })));
  ok(r.data.count >= 2, "count with $in");
  r = await admin.get("/api/entities/Partner?fields=business_name&q=" + encodeURIComponent(JSON.stringify({ business_name: "Salon One" })));
  ok(r.data.items.length === 1 && !("status" in r.data.items[0]), "fields projection");
  r = await admin.get("/api/entities/Partner?q=" + encodeURIComponent(JSON.stringify({ "x') OR 1=1 --": 1 })));
  ok(r.status === 400, "malicious field name rejected");
  r = await admin.get("/api/entities/Partner?q=" + encodeURIComponent(JSON.stringify({ $where: "1" })));
  ok(r.status === 400, "unknown operator rejected");
  r = await admin.get("/api/entities/Nope");
  ok(r.status === 404, "unknown entity -> 404");
  r = await user.get("/api/entities/Client");
  ok(r.status === 403, "admin-only entity (Client) is closed to partners");
  r = await user.post("/api/entities/AuditLog", { action: "forged" });
  ok(r.status === 403, "partner cannot forge audit logs");

  console.log("\n== Public referral functions + business logic ==");
  r = await anon.post("/api/fn/trackClick", { referralCode: `ONE${run}`, utmSource: "ig" });
  const clickId = r.data?.clickId;
  ok(r.status === 200 && r.data.clickId, "trackClick works without a session", JSON.stringify(r.data));
  r = await anon.post("/api/fn/trackClick", { referralCode: "NOPE" });
  ok(r.status === 404, "trackClick unknown code -> 404");
  r = await anon.post("/api/fn/captureReferral", { referralCode: `ONE${run}`, clientName: "Client A", clientPhone: "+971501112233", clickId });
  ok(r.status === 200 && r.data.referralId, "captureReferral creates a referral", JSON.stringify(r.data));
  const refId = r.data.referralId;
  r = await user.get("/api/entities/Referral");
  ok(r.data.items.length === 1 && r.data.items[0].id === refId, "partner sees their referral (partner_user_id RLS)", JSON.stringify(r.data));
  r = await other.get("/api/entities/Referral");
  ok(r.data.items.length === 0, "other partner doesn't see it");
  r = await anon.post("/api/fn/approveCommission", { commissionId: "x", action: "approve" });
  ok(r.status === 401, "private function needs a session");
  r = await user.post("/api/fn/approveCommission", { commissionId: "x", action: "approve" });
  ok(r.status === 403, "approveCommission is admin-only");
  r = await user.post("/api/fn/updatePartnerProfile", { phone: "+971509999999", commission_percentage: 100 });
  ok(r.status === 200 && r.data.partner.phone === "+971509999999" && r.data.partner.commission_percentage === 10, "updatePartnerProfile only touches allowed fields", JSON.stringify(r.data));
  r = await admin.post("/api/fn/processCommission", { referralId: refId, grossAmount: 1000 });
  ok(r.status === 200, "processCommission (admin)", JSON.stringify(r.data));
  const commissionId = r.data?.commission?.id;
  r = await admin.post("/api/fn/processCommission", { referralId: refId, grossAmount: 1000 });
  ok(r.status === 409, "second commission for the same referral is refused");
  r = await admin.post("/api/fn/processCommission", { referralId: refId, grossAmount: -5 });
  ok(r.status === 400 || r.status === 409, "negative amount is refused");

  console.log("\n== Money rules ==");
  r = await admin.post("/api/fn/approveCommission", { commissionId, action: "approve" });
  ok(r.status === 200 && r.data.status === "payable", "approve -> payable");
  r = await admin.post("/api/fn/createPayout", { partnerId: p2.id, commissionIds: [commissionId] });
  ok(r.status === 400, "payout refused when the commission belongs to another partner", JSON.stringify(r.data));
  r = await admin.post("/api/fn/createPayout", { partnerId: p1.id, commissionIds: [commissionId, commissionId] });
  ok(r.status === 200, "duplicate ids in a payout are de-duplicated", JSON.stringify(r.data));
  r = await admin.post("/api/fn/approveCommission", { commissionId, action: "approve" });
  ok(r.status === 409, "a PAID commission cannot be re-approved");
  r = await admin.post("/api/fn/createPayout", { partnerId: p1.id, commissionIds: [commissionId] });
  ok(r.status === 400, "a PAID commission cannot be paid twice");
  {
    // five admins click "pay" on the same commission at once -> exactly one payout
    const rf = (await anon.post("/api/fn/captureReferral", { referralCode: `ONE${run}`, clientName: "Race", clientPhone: "+971507770001" })).data.referralId;
    const cm = (await admin.post("/api/fn/processCommission", { referralId: rf, grossAmount: 500 })).data.commission.id;
    await admin.post("/api/fn/approveCommission", { commissionId: cm, action: "approve" });
    const res = await Promise.all([1, 2, 3, 4, 5].map(() => admin.post("/api/fn/createPayout", { partnerId: p1.id, commissionIds: [cm] })));
    const wins = res.filter((x) => x.status === 200).length;
    ok(wins === 1, "5 concurrent payouts of one commission -> exactly 1 succeeds", `got ${wins}`);
    const pays = (await admin.get("/api/entities/Payout?q=" + encodeURIComponent(JSON.stringify({ partner_id: p1.id })))).data.items;
    const withCm = pays.filter((x) => (x.commission_ids || []).includes(cm)).length;
    ok(withCm === 1, "only one payout record references that commission", `got ${withCm}`);
    const st = (await admin.get(`/api/entities/Commission/${cm}`)).data;
    ok(st.status === "paid" && !st.claim_token && st.payout_id, "commission ends paid, linked to its payout, claim token cleared", JSON.stringify(st));
  }
  r = await admin.post("/api/fn/pushToGitHub", { message: "x", files: [{ path: "a", content: "b" }] });
  ok(r.status === 403, "pushToGitHub is disabled by default");

  console.log("\n== Public endpoint hardening ==");
  r = await anon.post("/api/fn/trackClick", { referralCode: { $gt: "" } });
  ok(r.status === 400, "operator injection in referralCode rejected", JSON.stringify(r.data));
  r = await anon.post("/api/fn/captureReferral", { referralCode: `ONE${run}`, clientName: "x".repeat(20000) });
  ok(r.status === 413 || r.status === 400, "oversized public payload rejected");
  r = await anon.post("/api/fn/captureReferral", { referralCode: `ONE${run}`, clientName: "Client B", clientPhone: "+971502223344" });
  ok(r.status === 200 && !("fraudScore" in r.data) && !("fraudFlag" in r.data), "fraud score is not exposed to the public", JSON.stringify(r.data));
  r = await admin.post("/api/fn/getGitHubIssues", { owner: "../../user", repo: "x" });
  ok(r.status === 400, "GitHub helper rejects path-traversal owner/repo");
  r = await admin.post("/api/entities/Commission/aggregate", { groupBy: "status", sum: "commission_amount" });
  ok(r.status === 200 && Array.isArray(r.data.rows) && r.data.rows.length >= 1 && typeof r.data.rows[0].sum_commission_amount === "number", "aggregate groupBy/sum", JSON.stringify(r.data));
  r = await admin.post("/api/entities/Referral/aggregate", { groupBy: "partner_name", count: true, sum: "gross_amount", sort: "-count", limit: 5 });
  ok(r.status === 200 && r.data.rows[0].count >= 1, "aggregate with sort -count");
  r = await user.get("/api/entities/Commission");
  ok(r.data.items.length >= 1 && r.data.items.every((c) => c.partner_user_id === me.id), "partner sees only their own commissions");

  console.log("\n== Password reset ==");
  r = await anon.post("/api/auth/password-reset/request", { email: `ghost-${run}@example.com` });
  const ghost = r;
  r = await anon.post("/api/auth/password-reset/request", { email: uEmail });
  ok(ghost.status === 200 && r.status === 200 && JSON.stringify(ghost.data) === JSON.stringify(r.data), "reset request is identical for known/unknown emails");
  const tok = await resetTokenFor(uEmail);
  ok(!!tok, "reset email contains a token");
  r = await anon.post("/api/auth/password-reset/confirm", { resetToken: "bogus", newPassword: "New-Passw0rd!" });
  ok(r.status === 400, "bogus reset token rejected");
  r = await anon.post("/api/auth/password-reset/confirm", { resetToken: decodeURIComponent(tok), newPassword: "short" });
  ok(r.status === 400, "weak new password rejected");
  r = await anon.post("/api/auth/password-reset/confirm", { resetToken: decodeURIComponent(tok), newPassword: "New-Passw0rd!" });
  ok(r.status === 200, "reset with valid token");
  r = await anon.post("/api/auth/password-reset/confirm", { resetToken: decodeURIComponent(tok), newPassword: "Another-Pass1!" });
  ok(r.status === 400, "reset token is single-use");
  r = await user.get("/api/auth/me");
  ok(r.status === 401, "reset signs out existing sessions");
  r = await new Client().post("/api/auth/login", { email: uEmail, password: pw });
  ok(r.status === 401, "old password no longer works");
  const u2 = new Client();
  r = await u2.post("/api/auth/login", { email: uEmail, password: "New-Passw0rd!" });
  ok(r.status === 200, "new password works");

  console.log("\n== Logout, CSRF, rate limiting ==");
  r = await u2.post("/api/auth/logout");
  ok(r.status === 200, "logout");
  r = await u2.get("/api/auth/me");
  ok(r.status === 401, "session invalid after logout");
  r = await admin.call("POST", "/api/entities/Service", { name: "x" }, { origin: "https://evil.example" });
  ok(r.status === 403, "cross-origin write rejected");
  const rl = new Client(); let last;
  for (let i = 0; i < 12; i++) last = await rl.post("/api/auth/login", { email: `rl-${run}@example.com`, password: "nope-nope-1" });
  ok(last.status === 429, "login is rate limited per email", String(last.status));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
