// POST /api/fn/:name — runs one of the business-logic functions in functions/_fn.
import { HttpError, json, clientIp } from "../../_lib/util.js";
import { getUser, rateLimit } from "../../_lib/auth.js";
import { bindContext } from "../../_lib/compat.ts";

import approveCommission from "../../_fn/approveCommission.ts";
import captureReferral from "../../_fn/captureReferral.ts";
import createPayout from "../../_fn/createPayout.ts";
import getGitHubIssues from "../../_fn/getGitHubIssues.ts";
import processCommission from "../../_fn/processCommission.ts";
import pushToGitHub from "../../_fn/pushToGitHub.ts";
import refundCommission from "../../_fn/refundCommission.ts";
import trackClick from "../../_fn/trackClick.ts";
import updatePartnerProfile from "../../_fn/updatePartnerProfile.ts";

// public: callable without a session (referral landing page) — rate limited per IP.
const FUNCTIONS = {
  approveCommission: { handler: approveCommission },
  createPayout: { handler: createPayout },
  getGitHubIssues: { handler: getGitHubIssues },
  processCommission: { handler: processCommission },
  pushToGitHub: { handler: pushToGitHub },
  refundCommission: { handler: refundCommission },
  updatePartnerProfile: { handler: updatePartnerProfile },
  trackClick: { handler: trackClick, public: true, limit: 60 },
  captureReferral: { handler: captureReferral, public: true, limit: 15 },
};

export async function onRequest({ request, env, params }) {
  if (request.method !== "POST") throw new HttpError(405, "Method not allowed");
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const fn = Object.prototype.hasOwnProperty.call(FUNCTIONS, name) ? FUNCTIONS[name] : null;
  if (!fn) throw new HttpError(404, "Unknown function");

  const user = await getUser(env, request);
  if (fn.public) {
    await rateLimit(env, request, `fn-${name}`, { limit: fn.limit, windowSec: 600 });
  } else if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  // Body limits; public endpoints additionally accept flat scalar values only. This blocks operator injection
  // such as {"referralCode": {"$gt": ""}} which would otherwise reach the query engine.
  const text = await request.text();
  if (text.length > (fn.public ? 16384 : 262144)) throw new HttpError(413, "Payload too large");
  if (fn.public) {
    let v;
    try { v = text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, "Invalid JSON body"); }
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw new HttpError(400, "Invalid JSON body");
    for (const [k, val] of Object.entries(v)) {
      const t = typeof val;
      if (val !== null && t !== "string" && t !== "number" && t !== "boolean") throw new HttpError(400, `Invalid value for ${k}`);
      if (t === "string" && val.length > 500) throw new HttpError(400, `${k} is too long`);
    }
  }

  // Never trust a client-supplied X-Forwarded-For: on Cloudflare the real address is cf-connecting-ip.
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-for", clientIp(request));
  headers.delete("x-real-ip");
  headers.delete("content-length");
  const req = new Request(request.url, { method: "POST", headers, body: text });
  bindContext(req, env, user);

  const res = await fn.handler(req);
  if (res.status >= 500) {
    // Never echo internal error text (SQL, stack, config) to the client
    console.error(`fn ${name} failed:`, await res.clone().text());
    return json({ error: "Internal server error" }, 500);
  }
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-store");
  return out;
}
