import { HttpError } from "./util.js";

// Referral codes: uppercase letters, digits and hyphens, 3-24 chars, unique. They appear in public links.
export const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;
export const normalizeCode = (c) => String(c ?? "").trim().toUpperCase();

// "Glow Salon JVC" -> "GLOWSALONJVC"; names without Latin letters (e.g. Arabic) fall back to "PARTNER" + digits.
export function baseCode(name) {
  const s = String(name || "").normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  return s.length >= 3 ? s : "PARTNER";
}

async function isTaken(store, code, exceptId) {
  const rows = await store.filter({ referral_code: code }, { limit: 2 });
  return rows.some((r) => r.id !== exceptId);
}

export async function uniqueCode(store, base, exceptId) {
  for (let i = 0; i < 25; i++) {
    const cand = i === 0 && base !== "PARTNER" ? base : `${base.slice(0, 12)}${Math.floor(100 + Math.random() * 900)}`;
    if (!(await isTaken(store, cand, exceptId))) return cand;
  }
  throw new HttpError(500, "Could not generate a referral code");
}

async function validatedCode(store, raw, exceptId) {
  const code = normalizeCode(raw);
  if (!CODE_RE.test(code)) throw new HttpError(400, "Referral code must be 3-24 characters: letters, digits or hyphens");
  if (await isTaken(store, code, exceptId)) throw new HttpError(409, "This referral code is already used by another partner");
  return code;
}

export async function preparePartnerCreate(store, body, origin) {
  const out = { ...body };
  const code = out.referral_code ? await validatedCode(store, out.referral_code) : await uniqueCode(store, baseCode(out.business_name));
  out.referral_code = code;
  out.referral_link = `${origin}/r/${code}`;
  return out;
}

export async function preparePartnerUpdate(store, id, body, origin) {
  if (body.referral_code === undefined) return body;
  const out = { ...body };
  const code = await validatedCode(store, out.referral_code, id);
  out.referral_code = code;
  out.referral_link = `${origin}/r/${code}`;
  return out;
}
