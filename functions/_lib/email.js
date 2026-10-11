import { HttpError } from "./util.js";

// Transactional email through Resend (https://resend.com).
// strict=true: failures are reported to the caller (verification codes, invitations).
// strict=false: failures are only logged (password-reset and notices must answer identically whether or not the
// account exists, so they cannot expose delivery errors).
// Local development: set DEV_EMAIL_LOG=1 (in .dev.vars) to print messages instead of sending them.
export async function sendEmail(env, { to, subject, text, html }, { strict = false } = {}) {
  try {
    if (!env.RESEND_API_KEY) {
      if (env.DEV_EMAIL_LOG === "1") {
        console.log(`[email:dev] to=${to} subject=${subject}\n${text}`);
        return true;
      }
      throw new HttpError(503, "Email delivery is not configured on this deployment (missing RESEND_API_KEY)");
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "Sasha Connect <no-reply@example.com>",
        to: [to],
        subject,
        text,
        html: html || `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend rejected the email:", res.status, await res.text().catch(() => ""));
      throw new HttpError(502, "We could not send the email. Please try again in a few minutes.");
    }
    return true;
  } catch (e) {
    if (strict) throw e;
    console.error("Email not sent:", e && e.message);
    return false;
  }
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const mail = {
  otp: (code) => ({
    subject: "Your Sasha Connect verification code",
    text: `Your verification code is ${code}.\n\nIt expires in 15 minutes. If you didn't request it, you can ignore this email.`,
  }),
  reset: (link) => ({
    subject: "Reset your Sasha Connect password",
    text: `Use this link to choose a new password (valid for 1 hour):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
  }),
  invite: (link) => ({
    subject: "You're invited to Sasha Connect",
    text: `You've been invited to Sasha Connect. Set your password here (valid for 7 days):\n\n${link}`,
  }),
  alreadyRegistered: (origin) => ({
    subject: "Sasha Connect sign-up attempt",
    text: `Someone tried to create an account with this email, but one already exists.\n\nLog in: ${origin}/login\nForgot your password: ${origin}/forgot-password`,
  }),
};
