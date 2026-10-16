// Partner e-mail notifications (controlled by the switches in Settings -> Notifications).
// Best effort: a failed e-mail never breaks the action that triggered it.
import { sendEmail } from "./email.js";
import { entityStore } from "./db.js";
import { ENTITIES } from "./policies.generated.js";

export async function clinicSettings(env) {
  try {
    const rows = await entityStore(env, "ClinicSetting").filter({ setting_key: "default" }, { limit: 1 });
    return { ...ENTITIES.ClinicSetting.defaults, ...(rows[0] || {}) };
  } catch {
    return { ...ENTITIES.ClinicSetting.defaults };
  }
}

const aed = (n) => `AED ${Number(n || 0).toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;

async function emailPartner(env, partnerId, subject, lines) {
  try {
    const partner = await entityStore(env, "Partner").get(partnerId);
    if (!partner || !partner.email) return false;
    const text = [`Hello ${partner.contact_person || partner.business_name},`, "", ...lines].join("\n");
    return await sendEmail(env, { to: partner.email, subject, text }); // non-strict
  } catch (e) {
    console.error("notify failed:", e && e.message);
    return false;
  }
}

export async function notifyCommissionApproved(env, origin, commission) {
  const s = await clinicSettings(env);
  if (!s.notify_email_on_commission_approval) return false;
  return emailPartner(env, commission.partner_id, "Your commission has been approved", [
    `A commission of ${aed(commission.commission_amount)}${commission.client_name ? ` for ${commission.client_name}` : ""} has been approved and will be included in your next payout.`,
    "",
    `Follow everything in your dashboard: ${origin}/portal`,
    "",
    s.clinic_name || "Sasha Aesthetics",
  ]);
}

export async function notifyPayoutPaid(env, origin, payout) {
  const s = await clinicSettings(env);
  if (!s.notify_email_on_payout) return false;
  return emailPartner(env, payout.partner_id, "Your payout has been sent", [
    `Your payout of ${aed(payout.amount)} has been sent.${payout.payment_reference ? ` Payment reference: ${payout.payment_reference}.` : ""}`,
    "",
    `Details are in your dashboard: ${origin}/portal/payouts`,
    "",
    s.clinic_name || "Sasha Aesthetics",
  ]);
}
