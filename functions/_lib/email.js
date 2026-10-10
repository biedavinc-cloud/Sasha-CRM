// Transactional email through Resend (https://resend.com). Without RESEND_API_KEY the message is logged
// (local development only).
export async function sendEmail(env, { to, subject, text, html }) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${text}`);
    return { ok: true, dev: true };
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
    console.error("Resend error", res.status, await res.text().catch(() => ""));
    return { ok: false };
  }
  return { ok: true };
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
