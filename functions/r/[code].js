// GET /r/:code — serves the normal app, with Open Graph tags so the link looks professional when pasted into
// WhatsApp / Instagram / Facebook / iMessage (social crawlers do not run JavaScript).
import { normalizeCode } from "../_lib/partners.js";
import { CSP } from "../_lib/csp.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const OG_IMAGE = "https://images.unsplash.com/photo-1631730486572-226e5cabe731?w=1200&h=630&fit=crop&q=80";

export async function onRequestGet({ request, env, params, next }) {
  const res = await next(); // the single-page app
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;

  const code = normalizeCode(Array.isArray(params.code) ? params.code[0] : params.code);
  let partner = null;
  if (env.DB && /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) {
    try {
      partner = await env.DB.prepare(
        "SELECT json_extract(data, '$.business_name') AS name FROM entities WHERE entity = 'Partner' AND json_extract(data, '$.referral_code') = ? AND json_extract(data, '$.status') = 'active' LIMIT 1"
      ).bind(code).first();
    } catch { /* preview is best-effort */ }
  }

  const title = "Book your consultation | Sasha Aesthetics";
  const desc = partner && partner.name
    ? `You were recommended by ${partner.name}. Leave your details and the Sasha Aesthetic Clinic team will contact you to book your consultation.`
    : "Leave your details and the Sasha Aesthetic Clinic team will contact you to book your consultation.";
  const url = new URL(request.url);
  const tags = [
    `<meta name="robots" content="noindex, nofollow">`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Sasha Aesthetics">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url.origin + url.pathname)}">`,
    `<meta property="og:image" content="${esc(OG_IMAGE)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(OG_IMAGE)}">`,
  ].join("\n    ");

  let html = await res.text();
  html = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    : html.replace("</head>", `<title>${esc(title)}</title></head>`);
  html = html.replace("</head>", `    ${tags}\n  </head>`);

  const headers = new Headers(res.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", CSP);
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.delete("content-length");
  return new Response(html, { status: 200, headers });
}
