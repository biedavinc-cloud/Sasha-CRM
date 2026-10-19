// Per-request context for the business-logic functions in functions/_fn: current user, service-role entity
// access (bypasses row-level rules on purpose), the environment bindings and the site origin.
import { entityStore } from "./db.js";

const contexts = new WeakMap<Request, { env: any; user: any }>();

export function bindContext(req: Request, env: any, user: any) {
  contexts.set(req, { env, user });
}

export function serverContext(req: Request): any {
  const bound = contexts.get(req);
  if (!bound) throw new Error("Request context missing");
  const { env, user } = bound;
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
