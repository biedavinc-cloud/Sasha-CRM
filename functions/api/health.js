import { json } from "../_lib/util.js";
import { iterations } from "../_lib/auth.js";

// GET /api/health — configuration status (booleans only, no secret values)
export async function onRequestGet({ env }) {
  const out = {
    db: Boolean(env.DB),
    migrated: false,
    indexes: false,
    secrets: {
      authSecret: Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 16),
      email: Boolean(env.RESEND_API_KEY || env.DEV_EMAIL_LOG === "1"),
      adminEmails: Boolean((env.ADMIN_EMAILS || "").trim()),
    },
    pbkdf2Iterations: iterations(env),
  };
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE name IN ('users','sessions','auth_codes','rate_limits','entities','idx_ent_status')"
      ).all();
      const names = new Set(results.map((r) => r.name));
      out.migrated = ["users", "sessions", "auth_codes", "rate_limits", "entities"].every((n) => names.has(n));
      out.indexes = names.has("idx_ent_status");
    } catch {
      out.db = false;
    }
  }
  out.ok = out.db && out.migrated && out.secrets.authSecret && out.secrets.email && out.secrets.adminEmails;
  return json(out, out.ok ? 200 : 503);
}
