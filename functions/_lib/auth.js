import { HttpError, b64url, fromB64url, enc, randomToken, sha256, timingSafeEqual, nowSec, nowIso, clientIp } from "./util.js";

const PBKDF2_ITERATIONS = 100000; // Cloudflare Workers caps PBKDF2 at 100k iterations
const SESSION_TTL = 30 * 24 * 3600;
const COOKIE = "sid";

// ---------- passwords ----------
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export function assertPasswordPolicy(pw) {
  if (typeof pw !== "string" || pw.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (pw.length > 128) throw new HttpError(400, "Password is too long (max 128 characters)");
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iter, salt, hash] = String(stored).split("$");
    if (scheme !== "pbkdf2") return false;
    const got = await pbkdf2(password, fromB64url(salt), Number(iter));
    return timingSafeEqual(b64url(got), hash);
  } catch {
    return false;
  }
}

// Burns roughly the same time as a real verification (used when the account doesn't exist).
export async function fakeVerify(password) {
  await pbkdf2(password, new Uint8Array(16), PBKDF2_ITERATIONS);
}

// ---------- secrets ----------
export function secret(env) {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) {
    throw new HttpError(500, "Server misconfigured: AUTH_SECRET is not set");
  }
  return env.AUTH_SECRET;
}

export const hashCode = (env, userId, code) => sha256(`${userId}:${code}:${secret(env)}`);
export const hashToken = (env, token) => sha256(`${token}:${secret(env)}`);

// ---------- cookies & sessions ----------
function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieString(request, name, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function createSession(env, request, userId) {
  const token = randomToken(32);
  const now = nowSec();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").bind(userId, now),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(
      await hashToken(env, token), userId, now + SESSION_TTL, now
    ),
  ]);
  return cookieString(request, COOKIE, token, SESSION_TTL);
}

export function clearSessionCookie(request) {
  return cookieString(request, COOKIE, "", 0);
}

export async function destroySession(env, request) {
  const token = parseCookies(request.headers.get("cookie"))[COOKIE];
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(env, token)).run();
}

export async function destroyAllSessions(env, userId) {
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export const publicUser = (u) => ({
  id: u.id, email: u.email, full_name: u.full_name || null, role: u.role, created_date: u.created_date,
});

export async function getUser(env, request) {
  const token = parseCookies(request.headers.get("cookie"))[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.role, u.created_date, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`
  ).bind(await hashToken(env, token)).first();
  if (!row || row.expires_at < nowSec()) return null;
  return publicUser(row);
}

export async function requireUser(env, request) {
  const user = await getUser(env, request);
  if (!user) throw new HttpError(401, "Authentication required");
  return user;
}

export function requireAdmin(user) {
  if (user.role !== "admin") throw new HttpError(403, "Forbidden");
}

// ---------- admin bootstrap ----------
export function isBootstrapAdmin(env, email) {
  return (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email);
}

export async function applyBootstrapRole(env, user) {
  if (isBootstrapAdmin(env, user.email) && user.role !== "admin") {
    await env.DB.prepare("UPDATE users SET role = 'admin', updated_date = ? WHERE id = ?").bind(nowIso(), user.id).run();
    user.role = "admin";
  }
  return user;
}

// ---------- rate limiting ----------
export async function rateLimit(env, request, action, { limit, windowSec, extra = "" }) {
  const key = `${action}:${extra || clientIp(request)}`;
  const now = nowSec();
  const row = await env.DB.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();
  if (!row || row.reset_at <= now) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at"
    ).bind(key, now + windowSec).run();
    return;
  }
  if (row.count >= limit) {
    throw new HttpError(429, "Too many attempts. Please try again later.", { retryAfter: row.reset_at - now });
  }
  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
}
