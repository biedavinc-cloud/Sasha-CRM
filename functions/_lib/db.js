// Generic entity store on D1: JSON records with id / created_date / updated_date / created_by and Mongo-style queries.
import { HttpError, uid, nowIso } from "./util.js";
import { ENTITIES } from "./policies.generated.js";

const META = new Set(["id", "created_date", "updated_date", "created_by"]);
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_LIMIT = 1000;

export const entityNames = () => Object.keys(ENTITIES);
export const hasEntity = (name) => Object.prototype.hasOwnProperty.call(ENTITIES, name);

// Field names are validated against FIELD_RE ([A-Za-z0-9_] only), so inlining them as a literal JSON path is safe
// and lets SQLite use the expression indexes from migrations/0002_indexes.sql.
function field(name) {
  if (typeof name !== "string" || !FIELD_RE.test(name)) throw new HttpError(400, `Invalid field name: ${name}`);
  return META.has(name) ? name : `json_extract(data, '$.${name}')`;
}

// D1 caps a statement at 100 bound parameters. Long IN lists are inlined as properly quoted literals instead.
function lit(v) {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && !v.includes("\u0000")) return `'${v.replace(/'/g, "''")}'`;
  throw new HttpError(400, "Unsupported value in query");
}

function bind(v) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || typeof v === "string" || typeof v === "number") return v;
  throw new HttpError(400, "Unsupported value in query");
}

function compare(name, cond, params) {
  if (cond === null) return `${field(name, params)} IS NULL`;
  if (typeof cond !== "object") {
    const e = field(name, params);
    params.push(bind(cond));
    return `${e} = ?`;
  }
  if (Array.isArray(cond)) throw new HttpError(400, "Unsupported value in query");
  const out = [];
  for (const [op, val] of Object.entries(cond)) {
    switch (op) {
      case "$eq": out.push(compare(name, val, params)); break;
      case "$ne": {
        if (val === null) { out.push(`${field(name, params)} IS NOT NULL`); break; }
        const e1 = field(name, params), e2 = field(name, params);
        params.push(bind(val));
        out.push(`(${e1} IS NULL OR ${e2} != ?)`);
        break;
      }
      case "$in":
      case "$nin": {
        if (!Array.isArray(val) || val.length > 500) throw new HttpError(400, `${op} expects an array`);
        if (!val.length) { out.push(op === "$in" ? "0" : "1"); break; }
        const inline = val.length > 30;
        const ph = inline ? val.map(lit).join(",") : val.map(() => "?").join(",");
        const e1 = field(name, params), e2 = field(name, params);
        if (!inline) val.forEach((x) => params.push(bind(x)));
        out.push(op === "$in" ? `${e1} IN (${ph})` : `(${e1} IS NULL OR ${e2} NOT IN (${ph}))`);
        break;
      }
      case "$gt": case "$gte": case "$lt": case "$lte": {
        const e = field(name, params);
        params.push(bind(val));
        out.push(`${e} ${{ $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op]} ?`);
        break;
      }
      case "$exists": out.push(`${field(name, params)} IS ${val ? "NOT " : ""}NULL`); break;
      default: throw new HttpError(400, `Unsupported operator: ${op}`);
    }
  }
  return out.length ? "(" + out.join(" AND ") + ")" : "1";
}

export function compile(q, params, depth = 0) {
  if (depth > 6) throw new HttpError(400, "Query too deeply nested");
  if (q === undefined || q === null) return "1";
  if (typeof q !== "object" || Array.isArray(q)) throw new HttpError(400, "Invalid query");
  const parts = [];
  for (const [k, v] of Object.entries(q)) {
    if (k === "$or" || k === "$and") {
      if (!Array.isArray(v) || !v.length || v.length > 50) throw new HttpError(400, `${k} expects a non-empty array`);
      parts.push("(" + v.map((s) => compile(s, params, depth + 1)).join(k === "$or" ? " OR " : " AND ") + ")");
    } else if (k.startsWith("$")) {
      throw new HttpError(400, `Unsupported operator: ${k}`);
    } else {
      parts.push(compare(k, v, params));
    }
  }
  return parts.length ? parts.join(" AND ") : "1";
}

function orderBy(sort, params) {
  const s = typeof sort === "string" && sort ? sort : "-created_date";
  const desc = s.startsWith("-");
  const name = s.replace(/^[-+]/, "");
  const e = field(name, params);
  const tie = field("id", params);
  return ` ORDER BY ${e} ${desc ? "DESC" : "ASC"}, ${tie} ASC`;
}

const toRecord = (row, fields) => {
  const rec = { id: row.id, created_date: row.created_date, updated_date: row.updated_date, created_by: row.created_by, ...JSON.parse(row.data) };
  if (Array.isArray(fields) && fields.length) {
    const out = { id: rec.id };
    for (const f of fields) if (f in rec) out[f] = rec[f];
    return out;
  }
  return rec;
};

const stripMeta = (obj) => {
  const o = { ...obj };
  for (const k of META) delete o[k];
  return o;
};

const unwrapPatch = (patch) => (patch && typeof patch === "object" && patch.$set ? patch.$set : patch);

export function entityStore(env, name, { actor } = {}) {
  if (!hasEntity(name)) throw new HttpError(404, `Unknown entity: ${name}`);
  const db = env.DB;
  const def = ENTITIES[name];

  const api = {
    async filter(query = {}, options = {}) {
      if (typeof options === "string") options = { sort: options };
      const limit = Math.min(Math.max(parseInt(options.limit ?? 100, 10) || 100, 1), MAX_LIMIT);
      const skip = Math.max(parseInt(options.skip ?? 0, 10) || 0, 0);
      const params = [name];
      const where = compile(query, params);
      const order = orderBy(options.sort, params);
      params.push(limit, skip);
      const { results } = await db
        .prepare(`SELECT id, data, created_date, updated_date, created_by FROM entities WHERE entity = ? AND (${where})${order} LIMIT ? OFFSET ?`)
        .bind(...params).all();
      const rows = results.map((r) => toRecord(r, options.fields));
      rows.items = rows; // legacy compatibility: callers use either the array or `.items`
      return rows;
    },
    async list(sort, limit) { return api.filter({}, { sort, limit }); },
    async get(id) {
      const rows = await api.filter({ id }, { limit: 1 });
      return rows[0] || null;
    },
    async count(query = {}) {
      const params = [name];
      const where = compile(query, params);
      const row = await db.prepare(`SELECT COUNT(*) AS c FROM entities WHERE entity = ? AND (${where})`).bind(...params).first();
      return row ? row.c : 0;
    },
    async aggregate(opts = {}) {
      const { query = {}, groupBy, sum, sort, limit = 100 } = opts;
      if (!groupBy) throw new HttpError(400, "groupBy is required");
      const params = [];
      const g = field(groupBy, params);
      let select = `${g} AS grp, COUNT(*) AS cnt`;
      let sumName = null;
      if (sum) {
        sumName = sum;
        select += `, SUM(${field(sum, params)}) AS sm`;
      }
      params.push(name);
      const where = compile(query, params);
      let order = "";
      if (sort) {
        const desc = String(sort).startsWith("-");
        const key = String(sort).replace(/^[-+]/, "");
        const col = key === "count" ? "cnt" : key === groupBy ? "grp" : sumName && key === `sum_${sumName}` ? "sm" : null;
        if (!col) throw new HttpError(400, `Cannot sort aggregate by ${key}`);
        order = ` ORDER BY ${col} ${desc ? "DESC" : "ASC"}`;
      }
      params.push(Math.min(Math.max(parseInt(limit, 10) || 100, 1), MAX_LIMIT));
      const { results } = await db
        .prepare(`SELECT ${select} FROM entities WHERE entity = ? AND (${where}) GROUP BY grp${order} LIMIT ?`)
        .bind(...params).all();
      const rows = results.map((r) => {
        const row = { [groupBy]: r.grp, count: r.cnt };
        if (sumName) row[`sum_${sumName}`] = r.sm ?? 0;
        return row;
      });
      return { rows };
    },
    async create(input, { id } = {}) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "Invalid record");
      const data = { ...def.defaults, ...stripMeta(input) };
      for (const r of def.required) {
        if (data[r] === undefined || data[r] === null) throw new HttpError(400, `Missing required field: ${r}`);
      }
      validateEnums(def, data);
      const now = nowIso();
      const rid = id || uid();
      await db.prepare("INSERT INTO entities (entity, id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(name, rid, JSON.stringify(data), now, now, actor?.email || null).run();
      return { id: rid, created_date: now, updated_date: now, created_by: actor?.email || null, ...data };
    },
    async update(id, patch) {
      const existing = await api.get(id);
      if (!existing) throw new HttpError(404, `${name} not found`);
      const { id: _i, created_date, updated_date: _u, created_by, ...old } = existing;
      const data = { ...old, ...stripMeta(unwrapPatch(patch) || {}) };
      validateEnums(def, data);
      const now = nowIso();
      await db.prepare("UPDATE entities SET data = ?, updated_date = ? WHERE entity = ? AND id = ?")
        .bind(JSON.stringify(data), now, name, id).run();
      return { id, created_date, updated_date: now, created_by, ...data };
    },
    async updateMany(query, patch) {
      const rows = await api.filter(query, { limit: MAX_LIMIT });
      const set = stripMeta(unwrapPatch(patch) || {});
      const now = nowIso();
      const stmts = rows.map((r) => {
        const { id, created_date, updated_date, created_by, ...old } = r;
        const data = { ...old, ...set };
        validateEnums(def, data);
        return db.prepare("UPDATE entities SET data = ?, updated_date = ? WHERE entity = ? AND id = ?").bind(JSON.stringify(data), now, name, id);
      });
      for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
      return { updated: rows.length };
    },
    // Atomic compare-and-set over several rows in ONE statement (used to claim commissions for a payout).
    // Returns how many rows matched `where` and were patched (JSON merge-patch; null removes a key).
    async claimMany(ids, { where = {}, patch }) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 500) return 0;
      if (!ids.every((i) => typeof i === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(i))) return 0;
      const params = [JSON.stringify(patch), nowIso(), name];
      // ids are validated above, so they can be inlined (a 500-id payout would exceed D1's 100-parameter limit)
      let sql = `UPDATE entities SET data = json_patch(data, ?), updated_date = ? WHERE entity = ? AND id IN (${ids.map((i) => `'${i}'`).join(",")})`;
      for (const [k, v] of Object.entries(where)) {
        sql += ` AND ${field(k)} = ?`;
        params.push(bind(v));
      }
      const res = await db.prepare(sql).bind(...params).run();
      return res.meta?.changes ?? 0;
    },
    async delete(id) {
      const res = await db.prepare("DELETE FROM entities WHERE entity = ? AND id = ?").bind(name, id).run();
      return { deleted: res.meta?.changes ?? 0 };
    },
  };
  return api;
}

function validateEnums(def, data) {
  for (const [k, allowed] of Object.entries(def.enums || {})) {
    const v = data[k];
    if (v !== undefined && v !== null && !allowed.includes(v)) {
      throw new HttpError(400, `Invalid value for ${k}`);
    }
  }
}
