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
  ok(r.status === 201 && r.data.status === "pending" && r.data.user_id !== "someone-else" && r.data.requested_role === "admin", "access request forced to pending/own id (requested role kept as a request only)", JSON.stringify(r.data));
  const reqId = r.data.id;
  r = await user.patch(`/api/entities/AccessRequest/${reqId}`, { status: "approved" });
  ok(r.status === 403, "user cannot approve own request");
  r = await user.get("/api/users");
  ok(r.status === 403, "user cannot list users");
  const me = (await user.get("/api/auth/me")).data;
  r = await user.patch(`/api/users/${me.id}`, { role: "admin" });
  ok(r.status === 403, "user cannot make themselves admin");
  r = await user.get("/api/auth/me");
  ok(r.data.role === "user", "asking for admin in the request does not change the real role");
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

  console.log("\n== D1 limits & diagnostics ==");
  const many = Array.from({ length: 300 }, (_, i) => `filler-${i}`);
  const oPartner = (await admin.post("/api/entities/Partner", { business_name: "O'Brien Salon", user_id: "x", referral_code: `OB${run}` })).data;
  r = await admin.get("/api/entities/Partner?q=" + encodeURIComponent(JSON.stringify({ business_name: { $in: [...many, "O'Brien Salon"] } })));
  ok(r.status === 200 && r.data.items.length === 1 && r.data.items[0].id === oPartner.id, "300-value $in list (inlined, quote-safe) finds the right row", JSON.stringify(r.data).slice(0, 120));
  r = await admin.get("/api/entities/Partner/count?q=" + encodeURIComponent(JSON.stringify({ business_name: { $nin: [...many, "O'Brien Salon"] } })));
  ok(r.status === 200 && r.data.count >= 1, "300-value $nin list");
  r = await admin.get("/api/entities/Partner?q=" + encodeURIComponent(JSON.stringify({ business_name: { $in: [...many, "x'); DROP TABLE entities;--"] } })));
  ok(r.status === 200 && r.data.items.length === 0, "SQL-looking value inside a long $in list is just data");
  r = await admin.get("/api/entities/Partner/count");
  ok(r.status === 200 && r.data.count >= 2, "tables intact after the injection attempt");
  r = await new Client().get("/api/health");
  ok(r.data.db === true && r.data.migrated === true && r.data.indexes === true && !JSON.stringify(r.data).includes("local-dev-secret"), "/api/health reports db+migrations+indexes, leaks no secrets", JSON.stringify(r.data));

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

  console.log("\n== Partners cannot see the clinic's internal fields ==");
  await admin.patch(`/api/entities/Partner/${p1.id}`, { contract_notes: "internal: negotiated rate" });
  const q = (o) => encodeURIComponent(JSON.stringify(o));
  r = await user.get("/api/entities/Referral");
  const bad = ["ip_address", "fraud_flag", "fraud_score", "fraud_reason", "click_id", "created_by"];
  ok(r.status === 200 && r.data.items.length >= 1 && r.data.items.every((x) => bad.every((k) => !(k in x))), "partner's Referral rows have no IP / fraud / click fields", JSON.stringify(r.data.items?.[0]));
  r = await admin.get("/api/entities/Referral?limit=1");
  ok(r.data.items[0].ip_address !== undefined && r.data.items[0].fraud_score !== undefined, "admin still sees those fields");
  r = await user.get(`/api/entities/Referral/${refId}`);
  ok(r.status === 200 && !("fraud_score" in r.data) && !("ip_address" in r.data), "single-record read is redacted too");
  r = await user.get("/api/entities/Referral?q=" + q({ fraud_flag: true }));
  ok(r.status === 400, "cannot filter by a hidden field (no inference)");
  r = await user.get("/api/entities/Referral?sort=-fraud_score");
  ok(r.status === 400, "cannot sort by a hidden field");
  r = await user.get("/api/entities/Referral?fields=ip_address");
  ok(r.status === 400, "cannot project a hidden field");
  r = await user.post("/api/entities/Referral/aggregate", { groupBy: "fraud_flag" });
  ok(r.status === 400, "cannot aggregate by a hidden field");
  r = await user.get("/api/entities/Commission");
  ok(r.data.items.length >= 1 && r.data.items.every((c) => !("approved_by" in c) && !("created_by" in c) && !("adjustment_notes" in c)), "Commission rows hide approver / notes");
  r = await user.get("/api/entities/Partner");
  ok(r.data.items.length === 1 && !("contract_notes" in r.data.items[0]) && !("created_by" in r.data.items[0]), "Partner row hides contract notes");
  r = await user.get("/api/entities/Payout");
  ok(r.data.items.every((x) => !("notes" in x) && !("created_by" in x)), "Payout rows hide internal notes");

  console.log("\n== Referral codes & professional links ==");
  const mkp = async (b) => admin.post("/api/entities/Partner", { status: "active", user_id: "", ...b }); // user_id "" = not invited yet
  const g1 = await mkp({ business_name: "Glow Salon" }), g2 = await mkp({ business_name: "Glow Salon" });
  ok(g1.status === 201 && g2.status === 201 && g1.data.referral_code === "GLOWSALON" && g2.data.referral_code !== g1.data.referral_code && /^GLOWSALON\d{3}$/.test(g2.data.referral_code), "two partners with the same name get distinct codes", `${g1.data.referral_code} / ${g2.data.referral_code}`);
  ok(g1.data.referral_link.endsWith("/r/GLOWSALON"), "referral_link is built from the code");
  const ar = await mkp({ business_name: "مركز التجميل" });
  ok(ar.status === 201 && /^PARTNER\d{3}$/.test(ar.data.referral_code), "name without Latin letters still gets a valid code", ar.data.referral_code);
  r = await mkp({ business_name: "X", referral_code: "bad code!" });
  ok(r.status === 400, "invalid custom code rejected");
  r = await mkp({ business_name: "X", referral_code: "glowsalon" });
  ok(r.status === 409, "duplicate custom code rejected (case-insensitive)");
  r = await mkp({ business_name: "Custom Clinic", referral_code: `my-clinic-${run}` });
  ok(r.status === 201 && r.data.referral_code === `MY-CLINIC-${run}`.toUpperCase(), "custom code is normalised to uppercase", r.data.referral_code);
  const cc = r.data;
  r = await admin.patch(`/api/entities/Partner/${cc.id}`, { referral_code: "GLOWSALON" });
  ok(r.status === 409, "changing a code to an existing one is refused");
  r = await admin.patch(`/api/entities/Partner/${cc.id}`, { referral_code: `renamed-${run}` });
  ok(r.status === 200 && r.data.referral_code === `RENAMED-${run}`.toUpperCase() && r.data.referral_link.endsWith(`/r/${r.data.referral_code}`), "renaming a code updates the link");
  r = await anon.post("/api/fn/trackClick", { referralCode: "glowsalon" });
  ok(r.status === 200, "links are case-insensitive");
  r = await anon.post("/api/fn/trackClick", { referralCode: "no spaces!" });
  ok(r.status === 404, "malformed code -> 404");

  console.log("\n== Public form validation & anti-abuse ==");
  const cap = (b) => anon.post("/api/fn/captureReferral", { referralCode: "GLOWSALON", ...b });
  r = await cap({ clientName: "A", clientPhone: "+971501234567" });
  ok(r.status === 400, "one-letter name rejected");
  r = await cap({ clientName: "Valid Name", clientPhone: "123" });
  ok(r.status === 400, "invalid phone rejected");
  r = await cap({ clientName: "Valid Name", clientPhone: "+971 50 123 4567", clientEmail: "not-an-email" });
  ok(r.status === 400, "invalid email rejected");
  const first = await cap({ clientName: "Dup Person", clientPhone: "+971 55 000 1111" });
  const second = await cap({ clientName: "Dup Person", clientPhone: "+971550001111" });
  ok(first.status === 200 && second.status === 200 && first.data.referralId === second.data.referralId, "double submission creates ONE referral");
  const clickOther = (await anon.post("/api/fn/trackClick", { referralCode: `ONE${run}` })).data.clickId;
  const stolen = await cap({ clientName: "Click Thief", clientPhone: "+971 55 000 2222", clickId: clickOther });
  const stolenRef = (await admin.get(`/api/entities/Referral/${stolen.data.referralId}`)).data;
  const stolenClick = (await admin.get(`/api/entities/ReferralClick/${clickOther}`)).data;
  ok(stolenRef.click_id === null && stolenClick.converted === false, "a click of another partner cannot be attached");

  console.log("\n== Link preview page (/r/CODE) ==");
  r = await anon.get("/r/GLOWSALON");
  ok(r.status === 200 && typeof r.data === "string" && r.data.includes('property="og:title"') && r.data.includes("recommended by Glow Salon") && r.data.includes('content="noindex, nofollow"'), "referral page carries Open Graph tags + noindex", String(r.data).slice(0, 80));
  ok(r.data.includes('<div id="root">') || r.data.includes('id="root"'), "and still serves the app");
  r = await anon.get("/r/DOESNOTEXIST");
  ok(r.status === 200 && !r.data.includes("recommended by"), "unknown code: plain app page, no partner name");
  const xss = await mkp({ business_name: '<img src=x onerror=alert(1)> "Salon"' });
  r = await anon.get(`/r/${xss.data.referral_code}`);
  ok(r.status === 200 && !r.data.includes("<img src=x") && r.data.includes("&lt;img src=x"), "partner name is HTML-escaped in the preview tags");

  console.log("\n== Change password ==");
  const cpEmail = `cp-${run}@example.com`;
  const A = new Client(), B = new Client();
  await A.post("/api/auth/register", { email: cpEmail, password: pw });
  await A.post("/api/auth/verify-otp", { email: cpEmail, otpCode: await otpFor(cpEmail) });
  await B.post("/api/auth/login", { email: cpEmail, password: pw });
  r = await anon.post("/api/auth/change-password", { currentPassword: pw, newPassword: "New-Passw0rd!" });
  ok(r.status === 401, "change-password needs a session");
  r = await A.post("/api/auth/change-password", { currentPassword: "wrong-password", newPassword: "Another-Pass1!" });
  ok(r.status === 400, "wrong current password refused");
  r = await A.post("/api/auth/change-password", { currentPassword: pw, newPassword: "short" });
  ok(r.status === 400, "weak new password refused");
  r = await A.post("/api/auth/change-password", { currentPassword: pw, newPassword: pw });
  ok(r.status === 400, "same password refused");
  r = await A.post("/api/auth/change-password", { currentPassword: pw, newPassword: "Another-Pass1!" });
  ok(r.status === 200, "password changed");
  ok((await A.get("/api/auth/me")).status === 200, "this device stays signed in");
  ok((await B.get("/api/auth/me")).status === 401, "other devices are signed out");
  ok((await new Client().post("/api/auth/login", { email: cpEmail, password: pw })).status === 401, "old password no longer works");
  ok((await new Client().post("/api/auth/login", { email: cpEmail, password: "Another-Pass1!" })).status === 200, "new password works");

  console.log("\n== Operations: status guard, client names, notifications, config, admin reset ==");
  const newRef = async (name, phone) => (await anon.post("/api/fn/captureReferral", { referralCode: `ONE${run}`, clientName: name, clientPhone: phone })).data.referralId;
  const rg = await newRef("Status Guard", "+971 55 000 3333");
  r = await admin.patch(`/api/entities/Referral/${rg}`, { status: "paid" });
  ok(r.status === 400, "referral cannot be set to 'paid' by hand");
  r = await admin.patch(`/api/entities/Referral/${rg}`, { status: "commission_payable" });
  ok(r.status === 400, "referral cannot be set to 'commission_payable' by hand");
  r = await admin.patch(`/api/entities/Referral/${rg}`, { status: "contacted" });
  ok(r.status === 200, "normal journey statuses are still editable");
  await admin.patch(`/api/entities/Referral/${rg}`, { status: "treatment_completed" });
  const cg = await admin.post("/api/fn/processCommission", { referralId: rg, grossAmount: 1000, eligibleAmount: 1000 });
  ok(cg.status === 200 && cg.data.commission.client_name === "Status Guard", "commission remembers the client's name", JSON.stringify(cg.data).slice(0, 120));

  const pEmail = `partner-${run}@example.com`;
  await admin.patch(`/api/entities/Partner/${p1.id}`, { email: pEmail, contact_person: "Pat" });
  const mails = (to, re) => fs.readFileSync(LOG, "utf8").split("[email:dev]").filter((b) => b.includes(`to=${to} `) && re.test(b)).length;
  await admin.post("/api/fn/approveCommission", { commissionId: cg.data.commission.id, action: "approve" });
  await sleep(400);
  ok(mails(pEmail, /Your commission has been approved/) === 1, "partner is e-mailed when a commission is approved");
  const pg = await admin.post("/api/fn/createPayout", { partnerId: p1.id, commissionIds: [cg.data.commission.id] });
  await admin.patch(`/api/entities/Payout/${pg.data.payout.id}`, { status: "paid", payment_reference: "REF-4242" });
  await sleep(400);
  ok(mails(pEmail, /Your payout has been sent[\s\S]*REF-4242/) === 1, "partner is e-mailed (with the reference) when a payout is marked paid");
  await admin.patch(`/api/entities/Payout/${pg.data.payout.id}`, { notes: "again" });
  await sleep(300);
  ok(mails(pEmail, /Your payout has been sent/) === 1, "no duplicate e-mail when a paid payout is edited again");

  const setting = (await admin.post("/api/entities/ClinicSetting", { setting_key: "default", notify_email_on_commission_approval: false, notify_email_on_payout: false })).data;
  const rg2 = await newRef("Silent Client", "+971 55 000 4444");
  await admin.patch(`/api/entities/Referral/${rg2}`, { status: "treatment_completed" });
  const cg2 = await admin.post("/api/fn/processCommission", { referralId: rg2, grossAmount: 500, eligibleAmount: 500 });
  await admin.post("/api/fn/approveCommission", { commissionId: cg2.data.commission.id, action: "approve" });
  await sleep(400);
  ok(mails(pEmail, /Your commission has been approved/) === 1, "switching notifications off in Settings stops the e-mails");

  r = await anon.get("/api/config");
  ok(r.status === 200 && r.data.referralBaseUrl === null, "config: no custom link domain by default", JSON.stringify(r.data));
  await admin.patch(`/api/entities/ClinicSetting/${setting.id}`, { referral_base_url: "https://join.example.com/" });
  r = await anon.get("/api/config");
  ok(r.data.referralBaseUrl === "https://join.example.com", "config: custom link domain is served (trailing slash removed)", JSON.stringify(r.data));
  await admin.patch(`/api/entities/ClinicSetting/${setting.id}`, { referral_base_url: "https://join.example.com/r/" });
  r = await anon.get("/api/config");
  ok(r.data.referralBaseUrl === "https://join.example.com", "config: a trailing /r/ is tolerated", JSON.stringify(r.data));
  for (const bad of ["javascript:alert(1)", "http://evil.example", "ftp://x.y", "https://a b.c"]) {
    await admin.patch(`/api/entities/ClinicSetting/${setting.id}`, { referral_base_url: bad });
    r = await anon.get("/api/config");
    if (r.data.referralBaseUrl !== null) ok(false, `config rejects unsafe base URL ${bad}`, JSON.stringify(r.data));
  }
  ok(true, "config rejects unsafe / non-https base URLs");
  await admin.patch(`/api/entities/ClinicSetting/${setting.id}`, { referral_base_url: "" });

  const target = new Client(); const tEmail = `reset-${run}@example.com`;
  await target.post("/api/auth/register", { email: tEmail, password: pw });
  await target.post("/api/auth/verify-otp", { email: tEmail, otpCode: await otpFor(tEmail) });
  const tId = (await target.get("/api/auth/me")).data.id;
  r = await user.post(`/api/users/${tId}/reset-password`);
  ok(r.status === 403, "a non-admin cannot reset passwords");
  r = await admin.post(`/api/users/${adminMe.id}/reset-password`);
  ok(r.status === 400, "admins use Change password for themselves");
  r = await admin.post("/api/users/doesnotexist/reset-password");
  ok(r.status === 404, "unknown user -> 404");
  r = await admin.post(`/api/users/${tId}/reset-password`);
  const temp = r.data.temporaryPassword;
  ok(r.status === 200 && /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/.test(temp || ""), "admin gets a one-time temporary password", JSON.stringify(r.data));
  ok((await target.get("/api/auth/me")).status === 401, "the user is signed out everywhere");
  ok((await new Client().post("/api/auth/login", { email: tEmail, password: pw })).status === 401, "old password stops working");
  ok((await new Client().post("/api/auth/login", { email: tEmail, password: temp })).status === 200, "temporary password works");

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
