import { json } from "../_lib/util.js";
import { entityStore } from "../_lib/db.js";
import { ENTITIES } from "../_lib/policies.generated.js";

// GET /api/config — public, non-sensitive display settings.
// Only a value an admin saved in Settings counts: there is no built-in domain.
export async function onRequestGet({ env }) {
  let row = {};
  try { row = (await entityStore(env, "ClinicSetting").filter({ setting_key: "default" }, { limit: 1 }))[0] || {}; } catch { /* no settings yet */ }
  const base = String(row.referral_base_url || "").trim().replace(/\/+$/, "").replace(/\/r$/, "");
  const placeholder = /^https?:\/\/(www\.)?sasha\.ae$/i.test(base); // an old made-up default that was saved by the Settings page, never a real domain
  const safe = !placeholder && (/^https:\/\/[^\s/]+$/.test(base) || /^http:\/\/localhost(:\d+)?$/.test(base));
  return json(
    { referralBaseUrl: safe ? base : null, clinicName: row.clinic_name || ENTITIES.ClinicSetting.defaults.clinic_name || "Sasha Aesthetics" },
    200,
    { "cache-control": "public, max-age=60" }
  );
}
