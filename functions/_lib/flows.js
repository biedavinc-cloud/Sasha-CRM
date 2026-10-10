import { uid, nowSec, randomToken, randomDigits } from "./util.js";
import { hashCode, hashToken } from "./auth.js";
import { sendEmail, mail } from "./email.js";

const OTP_TTL = 15 * 60;
const RESET_TTL = 3600;
const INVITE_TTL = 7 * 24 * 3600;
const origin = (request) => new URL(request.url).origin;

export async function issueOtp(env, user) {
  const code = randomDigits(6);
  const now = nowSec();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_codes WHERE user_id = ? AND kind = 'otp'").bind(user.id),
    env.DB.prepare("INSERT INTO auth_codes (id, user_id, kind, code_hash, expires_at, created_at) VALUES (?, ?, 'otp', ?, ?, ?)").bind(
      uid(), user.id, await hashCode(env, user.id, code), now + OTP_TTL, now
    ),
  ]);
  const m = mail.otp(code);
  await sendEmail(env, { to: user.email, ...m });
}

export async function issueLink(env, request, user, kind) {
  const token = randomToken(32);
  const now = nowSec();
  const ttl = kind === "invite" ? INVITE_TTL : RESET_TTL;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_codes WHERE user_id = ? AND kind IN ('reset','invite')").bind(user.id),
    env.DB.prepare("INSERT INTO auth_codes (id, user_id, kind, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      uid(), user.id, kind, await hashToken(env, token), now + ttl, now
    ),
  ]);
  const link = `${origin(request)}/reset-password?token=${encodeURIComponent(token)}`;
  const m = kind === "invite" ? mail.invite(link) : mail.reset(link);
  await sendEmail(env, { to: user.email, ...m });
}

