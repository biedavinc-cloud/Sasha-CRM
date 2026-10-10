// One-off: derives functions/_lib/policies.generated.js from the legacy Base44 entity schemas.
// After the migration this generated file is the source of truth; edit it directly.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("base44/entities");
const out = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".jsonc")).sort()) {
  const raw = fs.readFileSync(path.join(dir, f), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const j = JSON.parse(raw);
  if (j.name === "User") continue; // users live in their own table
  const defaults = {};
  const enums = {};
  for (const [k, v] of Object.entries(j.properties || {})) {
    if ("default" in v) defaults[k] = v.default;
    if (Array.isArray(v.enum)) enums[k] = v.enum;
  }
  out[j.name] = { defaults, enums, required: j.required || [], rls: j.rls || {} };
}
const body =
  "// GENERATED from base44/entities/*.jsonc by scripts/gen-policies.mjs — now the source of truth.\n" +
  "export const ENTITIES = " + JSON.stringify(out, null, 2) + ";\n";
fs.writeFileSync("functions/_lib/policies.generated.js", body);
console.log("entities:", Object.keys(out).join(", "));
