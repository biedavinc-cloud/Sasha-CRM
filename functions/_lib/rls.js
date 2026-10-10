// Row-level security evaluator for the rules in policies.generated.js (Base44 "rls" format).
// Result of evaluating a rule: true (unrestricted) | false (denied) | a query object (row restriction).
import { HttpError } from "./util.js";
import { ENTITIES } from "./policies.generated.js";

const ADMIN_ONLY = { user_condition: { role: "admin" } };
// Hardening vs. the Base44 config: these were open to any signed-in user, but the app only ever writes
// them from server functions (service role), so direct client writes are admin-only.
const OVERRIDES = {
  AuditLog: { create: ADMIN_ONLY },
  ReferralClick: { create: ADMIN_ONLY },
};

const sub = (v, user) => (v === "{{user.id}}" ? user.id : v === "{{user.email}}" ? user.email : v);

function evalRule(rule, user) {
  if (!rule || typeof rule !== "object") return false; // fail closed
  const parts = [];
  for (const [k, v] of Object.entries(rule)) {
    if (k === "user_condition") {
      if (!Object.entries(v).every(([f, want]) => user[f] === want)) return false;
    } else if (k === "$or") {
      const branches = v.map((r) => evalRule(r, user)).filter((r) => r !== false);
      if (!branches.length) return false;
      if (branches.includes(true)) continue;
      parts.push({ $or: branches });
    } else if (k.startsWith("data.")) {
      parts.push({ [k.slice(5)]: sub(v, user) });
    } else if (k === "created_by") {
      parts.push({ created_by: sub(v, user) });
    } else {
      return false; // unknown construct: deny
    }
  }
  if (!parts.length) return true;
  return parts.length === 1 ? parts[0] : { $and: parts };
}

function ruleFor(entity, action) {
  return OVERRIDES[entity]?.[action] ?? ENTITIES[entity]?.rls?.[action];
}

export function restriction(entity, action, user) {
  return evalRule(ruleFor(entity, action), user);
}

// Query to run for reads/updates/deletes of existing rows. Throws 403 if the action is denied.
export function scopedQuery(entity, action, user, query = {}) {
  const r = restriction(entity, action, user);
  if (r === false) throw new HttpError(403, "Forbidden");
  return r === true ? query : { $and: [query, r] };
}

// Creates cannot be row-scoped here; only unrestricted rules allow them.
export function assertCanCreate(entity, user) {
  if (restriction(entity, "create", user) !== true) throw new HttpError(403, "Forbidden");
}
