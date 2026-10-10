import { HttpError, json, readJson, normalizeEmail, uid, nowIso, nowSec, randomToken, randomDigits, clientIp } from "../../_lib/util.js";
import {
  hashPassword, verifyPassword, fakeVerify, assertPasswordPolicy, hashCode, hashToken, createSession, clearSessionCookie,
  destroySession, destroyAllSessions, getUser, publicUser, applyBootstrapRole, rateLimit, secret,
} from "../../_lib/auth.js";
import { sendEmail, mail } from "../../_lib/email.js";
import { issueOtp, issueLink } from "../../_lib/flows.js";

const GENERIC_LOGIN_ERROR = "Invalid email or password";

const origin = (request) => new URL(request.url).origin;
const googleEnabled = (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

async function findUserByEmail(env, email) {
  return env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
}

async function startSession(env, request, userRow) {
  const user = await applyBootstrapRole(env, publicUser(userRow));
  const cookie = await createSession(env, request, user.id);
  return json({ ok: true, user }, 200, { "set-cookie": cookie });
}

const routes = {
  "GET config": async ({ env }) => json({ google: googleEnabled(env) }),

  "GET me": async ({ env, request }) => {
    const user = await getUser(env, request);
    if (!user) throw new HttpError(401, "Authentication required");
    return json(user);
  },

  "POST register": async ({ env, request }) => {
    secret(env);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    assertPasswordPolicy(body.password);
    await rateLimit(env, request, "register-ip", { limit: 10, windowSec: 3600 });
    await rateLimit(env, request, "register-email", { limit: 5, windowSec: 3600, extra: email });

    const existing = await findUserByEmail(env, email);
    if (existing && existing.email_verified) {
      // Don't reveal that the account exists: same response, but tell the owner by email.
      await sendEmail(env, { to: email, ...mail.alreadyRegistered(origin(request)) });
      return json({ ok: true });
    }
    const hash = await hashPassword(body.password);
    const now = nowIso();
    let user = existing;
    if (existing) {
      await env.DB.prepare("UPDATE users SET password_hash = ?, updated_date = ? WHERE id = ?").bind(hash, now, existing.id).run();
    } else {
      const fullName = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 120) || null : null;
      user = { id: uid(), email, full_name: fullName, role: "user" };
      await env.DB.prepare(
        "INSERT INTO users (id, email, full_name, role, password_hash, email_verified, created_date, updated_date) VALUES (?, ?, ?, 'user', ?, 0, ?, ?)"
      ).bind(user.id, email, fullName, hash, now, now).run();
    }
    await issueOtp(env, user);
    return json({ ok: true });
  },

  "POST verify-otp": async ({ env, request }) => {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const code = String(body.otpCode || "").trim();
    await rateLimit(env, request, "otp-ip", { limit: 30, windowSec: 900 });
    const user = await findUserByEmail(env, email);
    const row = user && await env.DB.prepare(
      "SELECT * FROM auth_codes WHERE user_id = ? AND kind = 'otp' AND used = 0 ORDER BY created_at DESC LIMIT 1"
    ).bind(user.id).first();
    const bad = () => new HttpError(400, "Invalid or expired verification code");
    if (!row || row.expires_at < nowSec()) throw bad();
    if (row.attempts >= 5) throw new HttpError(400, "Too many incorrect attempts. Please request a new code.");
    if ((await hashCode(env, user.id, code)) !== row.code_hash) {
      await env.DB.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
      throw bad();
    }
    await env.DB.batch([
      env.DB.prepare("UPDATE auth_codes SET used = 1 WHERE id = ?").bind(row.id),
      env.DB.prepare("UPDATE users SET email_verified = 1, updated_date = ? WHERE id = ?").bind(nowIso(), user.id),
    ]);
    return startSession(env, request, user);
  },

  "POST resend-otp": async ({ env, request }) => {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    await rateLimit(env, request, "resend-ip", { limit: 10, windowSec: 3600 });
    await rateLimit(env, request, "resend-email", { limit: 5, windowSec: 3600, extra: email });
    const user = await findUserByEmail(env, email);
    if (user && !user.email_verified) await issueOtp(env, user);
    return json({ ok: true });
  },

  "POST login": async ({ env, request }) => {
    secret(env);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    await rateLimit(env, request, "login-ip", { limit: 30, windowSec: 900 });
    await rateLimit(env, request, "login-email", { limit: 10, windowSec: 900, extra: email });
    const user = await findUserByEmail(env, email);
    if (!user || !user.password_hash || password.length > 128) {
      await fakeVerify(password);
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }
    if (!(await verifyPassword(password, user.password_hash))) throw new HttpError(401, GENERIC_LOGIN_ERROR);
    if (!user.email_verified) {
      await issueOtp(env, user);
      throw new HttpError(403, "Please verify your email address. We sent you a new code.", { code: "verification_required", email });
    }
    return startSession(env, request, user);
  },

  "POST logout": async ({ env, request }) => {
    await destroySession(env, request);
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(request) });
  },

  "POST password-reset/request": async ({ env, request }) => {
    secret(env);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    await rateLimit(env, request, "reset-ip", { limit: 10, windowSec: 3600 });
    await rateLimit(env, request, "reset-email", { limit: 3, windowSec: 3600, extra: email });
    const user = await findUserByEmail(env, email);
    if (user) await issueLink(env, request, user, "reset");
    return json({ ok: true }); // identical response whether or not the account exists
  },

  "POST password-reset/confirm": async ({ env, request }) => {
    const body = await readJson(request);
    assertPasswordPolicy(body.newPassword);
    await rateLimit(env, request, "reset-confirm-ip", { limit: 20, windowSec: 900 });
    const token = String(body.resetToken || "");
    const row = token && await env.DB.prepare(
      "SELECT * FROM auth_codes WHERE code_hash = ? AND kind IN ('reset','invite') AND used = 0"
    ).bind(await hashToken(env, token)).first();
    if (!row || row.expires_at < nowSec()) throw new HttpError(400, "This reset link is invalid or has expired");
    const hash = await hashPassword(body.newPassword);
    await env.DB.batch([
      env.DB.prepare("UPDATE auth_codes SET used = 1 WHERE id = ?").bind(row.id),
      env.DB.prepare("UPDATE users SET password_hash = ?, email_verified = 1, updated_date = ? WHERE id = ?").bind(hash, nowIso(), row.user_id),
    ]);
    await destroyAllSessions(env, row.user_id); // a reset signs out every device
    return json({ ok: true });
  },

  // ---------- Google sign-in (optional; enabled when GOOGLE_CLIENT_ID/SECRET are set) ----------
  "GET google/start": async ({ env, request }) => {
    if (!googleEnabled(env)) throw new HttpError(404, "Google sign-in is not configured");
    const url = new URL(request.url);
    const state = randomToken(24);
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    g.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    }).toString();
    const secure = url.protocol === "https:" ? "; Secure" : "";
    const cookie = `g_state=${encodeURIComponent(state + "|" + returnTo)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
    return new Response(null, { status: 302, headers: { location: g.toString(), "set-cookie": cookie } });
  },

  "GET google/callback": async ({ env, request }) => {
    if (!googleEnabled(env)) throw new HttpError(404, "Google sign-in is not configured");
    const url = new URL(request.url);
    const cookie = /(?:^|;\s*)g_state=([^;]+)/.exec(request.headers.get("cookie") || "");
    const [state, returnTo] = cookie ? decodeURIComponent(cookie[1]).split("|") : [];
    const clearState = `g_state=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0`;
    const fail = (why) => new Response(null, { status: 302, headers: { location: `/login?error=${why}`, "set-cookie": clearState } });
    if (!state || state !== url.searchParams.get("state") || !url.searchParams.get("code")) return fail("google_state");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: url.searchParams.get("code"),
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("google_token");
    const { id_token } = await tokenRes.json();
    // The id_token comes straight from Google's token endpoint over TLS, so decoding it is sufficient (OIDC core §3.1.3.7).
    let claims;
    try { claims = JSON.parse(atob(id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return fail("google_token"); }
    if (claims.aud !== env.GOOGLE_CLIENT_ID || !claims.email || claims.email_verified !== true) return fail("google_unverified");

    const email = claims.email.toLowerCase();
    let user = await env.DB.prepare("SELECT * FROM users WHERE google_sub = ? OR email = ?").bind(claims.sub, email).first();
    const now = nowIso();
    if (!user) {
      user = { id: uid(), email, full_name: claims.name || null, role: "user" };
      await env.DB.prepare(
        "INSERT INTO users (id, email, full_name, role, email_verified, google_sub, created_date, updated_date) VALUES (?, ?, ?, 'user', 1, ?, ?, ?)"
      ).bind(user.id, email, user.full_name, claims.sub, now, now).run();
    } else {
      await env.DB.prepare("UPDATE users SET google_sub = COALESCE(google_sub, ?), password_hash = CASE WHEN email_verified = 0 THEN NULL ELSE password_hash END, email_verified = 1, updated_date = ? WHERE id = ?").bind(claims.sub, now, user.id).run();
    }
    const u = await applyBootstrapRole(env, publicUser(user));
    const session = await createSession(env, request, u.id);
    const headers = new Headers({ location: safeReturnTo(returnTo) });
    headers.append("set-cookie", session);
    headers.append("set-cookie", clearState);
    return new Response(null, { status: 302, headers });
  },
};

// Same-origin relative path only (blocks //evil.com, /\evil.com, absolute URLs)
function safeReturnTo(raw) {
  if (!raw || typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw.slice(0, 500);
}

export async function onRequest({ request, env, params }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  const handler = routes[`${request.method} ${path}`];
  if (!handler) throw new HttpError(404, "Not found");
  return handler({ request, env });
}
