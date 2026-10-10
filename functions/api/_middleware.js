import { json, errorResponse } from "../_lib/util.js";

export async function onRequest(context) {
  const { request } = context;
  try {
    // CSRF defence in depth (cookies are also SameSite=Lax): state-changing requests must be same-origin.
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: "Bad origin" }, 403);
      const ct = request.headers.get("content-type") || "";
      const hasBody = request.headers.get("content-length") !== "0" && request.headers.get("content-length") !== null;
      if (hasBody && !ct.includes("application/json")) return json({ error: "Unsupported content type" }, 415);
    }
    const res = await context.next();
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
