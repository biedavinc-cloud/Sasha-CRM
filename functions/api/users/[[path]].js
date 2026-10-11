//   GET   /api/users              list users (admin)
//   PATCH /api/users/:id          change role / name (admin)
//   POST  /api/users/invite       { email, role } -> create (or find) the user and email a set-password link.
//                                 Partners/staff still go through the access-request approval, as the Users screen states.
import { HttpError, json, readJson, normalizeEmail, uid, nowIso } from "../../_lib/util.js";
import { requireUser, requireAdmin, publicUser } from "../../_lib/auth.js";
import { issueLink } from "../../_lib/flows.js";

const ROLES = ["admin", "user"];

export async function onRequest({ request, env, params }) {
  const [a] = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const me = await requireUser(env, request);
  requireAdmin(me);

  if (!a && request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, email, full_name, role, created_date FROM users ORDER BY created_date DESC LIMIT 1000"
    ).all();
    return json({ items: results });
  }

  if (a === "invite" && request.method === "POST") {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const role = body.role === "admin" ? "admin" : "user";
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    const now = nowIso();
    if (!user) {
      user = { id: uid(), email, full_name: null, role, created_date: now };
      await env.DB.prepare(
        "INSERT INTO users (id, email, role, email_verified, created_date, updated_date) VALUES (?, ?, ?, 0, ?, ?)"
      ).bind(user.id, email, role, now, now).run();
    }
    // Only send a set-password link if the person has no password yet.
    if (!user.password_hash) await issueLink(env, request, user, "invite");
    return json({ id: user.id, email, role: user.role }, 201);
  }

  if (a && request.method === "PATCH") {
    const body = await readJson(request);
    const target = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(a).first();
    if (!target) throw new HttpError(404, "User not found");
    const role = body.role === undefined ? target.role : body.role;
    if (!ROLES.includes(role)) throw new HttpError(400, "Invalid role");
    if (target.id === me.id && role !== "admin") throw new HttpError(400, "You cannot remove your own admin role");
    const name = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 120) : target.full_name;
    await env.DB.prepare("UPDATE users SET role = ?, full_name = ?, updated_date = ? WHERE id = ?").bind(role, name, nowIso(), a).run();
    return json(publicUser({ ...target, role, full_name: name }));
  }

  throw new HttpError(404, "Not found");
}
