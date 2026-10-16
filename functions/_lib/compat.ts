// Server-side stand-in for `createClientFromRequest` from the Base44 SDK, so the business-logic functions
// in functions/_fn keep working unchanged. Implements only what they use.
import { entityStore } from "./db.js";

const contexts = new WeakMap<Request, { env: any; user: any }>();

export function bindContext(req: Request, env: any, user: any) {
  contexts.set(req, { env, user });
}

export function createClientFromRequest(req: Request): any {
  const ctx = contexts.get(req);
  if (!ctx) throw new Error("Request context missing");
  const { env, user } = ctx;
  return {
    env,
    origin: new URL(req.url).origin,
    auth: { me: async () => user },
    asServiceRole: {
      entities: new Proxy({}, { get: (_t, name) => entityStore(env, String(name), { actor: user }) }),
      connectors: {
        getConnection: async (name: string) => {
          if (name === "github" && env.GITHUB_TOKEN) return { accessToken: env.GITHUB_TOKEN };
          throw new Error(`Connector "${name}" is not configured (set the GITHUB_TOKEN secret)`);
        },
      },
    },
  };
}
