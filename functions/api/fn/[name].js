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

  // Never trust a client-supplied X-Forwarded-For: on Cloudflare the real address is cf-connecting-ip.
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-for", clientIp(request));
  headers.delete("x-real-ip");
  const req = new Request(request, { headers });
  bindContext(req, env, user);

  const res = await fn.handler(req);
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "no-store");
  return out;
}
