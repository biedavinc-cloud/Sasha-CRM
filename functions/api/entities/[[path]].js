// REST facade over the entity store.
//   GET    /api/entities/:name?q=<json>&sort=&limit=&skip=&fields=a,b   -> filter
//   GET    /api/entities/:name/count?q=<json>
//   POST   /api/entities/:name/aggregate   { query, groupBy, sum, sort, limit }
//   GET    /api/entities/:name/:id
//   POST   /api/entities/:name             create
//   PATCH  /api/entities/:name/:id         update
//   DELETE /api/entities/:name/:id
import { HttpError, json, readJson } from "../../_lib/util.js";
import { requireUser } from "../../_lib/auth.js";
import { entityStore, hasEntity } from "../../_lib/db.js";
import { scopedQuery, assertCanCreate, redact, assertVisibleFields } from "../../_lib/rls.js";
import { preparePartnerCreate, preparePartnerUpdate } from "../../_lib/partners.js";

const parseQ = (url) => {
  const raw = url.searchParams.get("q");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "Invalid q parameter"); }
};

// Non-admins only reach the data once head office approved them (enforced here, not just in the UI).
async function assertApproved(env, user) {
  if (user.role === "admin") return;
  const n = await entityStore(env, "AccessRequest").count({ user_id: user.id, status: "approved" });
  if (!n) throw new HttpError(403, "Your account is awaiting approval");
}

export async function onRequest({ request, env, params }) {
  const [name, a, b] = Array.isArray(params.path) ? params.path : [params.path];
  if (!name || !hasEntity(name)) throw new HttpError(404, "Unknown entity");
  const user = await requireUser(env, request);
  if (name !== "AccessRequest") await assertApproved(env, user);

  const store = entityStore(env, name, { actor: user });
  const url = new URL(request.url);
  const method = request.method;

  // ----- collection-level -----
  if (!a) {
    if (method === "GET") {
      const fields = url.searchParams.get("fields");
      const userQuery = parseQ(url);
      assertVisibleFields(name, user, { query: userQuery, sort: url.searchParams.get("sort"), fields: fields ? fields.split(",") : undefined });
      const query = scopedQuery(name, "read", user, userQuery);
      const rows = await store.filter(query, {
        sort: url.searchParams.get("sort") || undefined,
        limit: url.searchParams.get("limit") || undefined,
        skip: url.searchParams.get("skip") || undefined,
        fields: fields ? fields.split(",") : undefined,
      });
      return json({ items: redact(name, user, [...rows]) });
    }
    if (method === "POST") {
      assertCanCreate(name, user);
      let body = await readJson(request);
      if (name === "AccessRequest" && user.role !== "admin") {
        // A user may only file ONE pending request for themselves; they can never set status/reviewer.
        const mine = await store.filter({ user_id: user.id }, { limit: 1 });
        if (mine.length) return json(mine[0]);
        body = {
          user_id: user.id,
          user_email: user.email,
          phone: str(body.phone, 40),
          note: str(body.note, 1000),
          requested_role: body.requested_role === "admin" ? "admin" : "user", // only a request: an admin assigns the real role
          status: "pending",
        };
      }
      if (name === "Partner") body = await preparePartnerCreate(store, body, url.origin);
      return json(await store.create(body), 201);
    }
    throw new HttpError(405, "Method not allowed");
  }

  if (a === "count" && method === "GET") {
    const q = parseQ(url);
    assertVisibleFields(name, user, { query: q });
    return json({ count: await store.count(scopedQuery(name, "read", user, q)) });
  }
  if (a === "aggregate" && method === "POST") {
    const opts = await readJson(request);
    assertVisibleFields(name, user, { query: opts.query, sort: opts.sort, groupBy: opts.groupBy, sum: opts.sum });
    return json(await store.aggregate({ ...opts, query: scopedQuery(name, "read", user, opts.query || {}) }));
  }

  // ----- single record -----
  const id = a;
  if (b) throw new HttpError(404, "Not found");
  if (method === "GET") {
    const rows = await store.filter(scopedQuery(name, "read", user, { id }), { limit: 1 });
    if (!rows.length) throw new HttpError(404, "Not found");
    return json(redact(name, user, rows[0]));
  }
  if (method === "PATCH" || method === "PUT") {
    const rows = await store.filter(scopedQuery(name, "update", user, { id }), { limit: 1 });
    if (!rows.length) throw new HttpError(404, "Not found");
    let patch = await readJson(request);
    if (name === "Partner") patch = await preparePartnerUpdate(store, id, patch, url.origin);
    return json(await store.update(id, patch));
  }
  if (method === "DELETE") {
    const rows = await store.filter(scopedQuery(name, "delete", user, { id }), { limit: 1 });
    if (!rows.length) throw new HttpError(404, "Not found");
    return json(await store.delete(id));
  }
  throw new HttpError(405, "Method not allowed");
}

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);
