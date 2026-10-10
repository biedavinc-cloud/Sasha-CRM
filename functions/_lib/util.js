export const enc = new TextEncoder();

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}

export function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export function randomDigits(n = 6) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 10 ** n).padStart(n, "0");
}

export async function sha256(str) {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(str)));
}

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const uid = () => {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const nowIso = () => new Date().toISOString();
export const nowSec = () => Math.floor(Date.now() / 1000);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
  });
}

export function errorResponse(err) {
  if (err instanceof HttpError) {
    return json({ error: err.message, ...err.extra }, err.status);
  }
  console.error("Unhandled error:", err && err.stack ? err.stack : err);
  return json({ error: "Internal server error" }, 500);
}

export async function readJson(request, maxBytes = 262144) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Payload too large");
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
    return v;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "local";
}

export function normalizeEmail(email) {
  if (typeof email !== "string") throw new HttpError(400, "Email is required");
  const e = email.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, "Please enter a valid email address");
  return e;
}
