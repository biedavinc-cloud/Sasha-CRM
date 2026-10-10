# Sasha CRM on Cloudflare Pages

Frontend: Vite + React (`dist/`). Backend: Pages Functions (`functions/`) + D1 (SQLite). No Base44 dependency.

```
functions/api/auth/     register · verify-otp · login · logout · me · password reset · Google (optional)
functions/api/entities/ REST over the entity store, with row-level security (functions/_lib/policies.generated.js)
functions/api/users/    admin: list / change role / invite
functions/api/fn/       business logic (functions/_fn/*): commissions, payouts, referral capture, GitHub
migrations/             D1 schema
src/api/client.js       frontend client (replaces the Base44 SDK)
scripts/smoke-test.mjs  66 end-to-end checks (auth, RLS, approval gate, rate limits…)
```

## Local development
```bash
npm install
npm run build
npm run cf:migrate:local
npm run cf:dev            # http://localhost:8788  (API + built frontend, local D1)
# second terminal, for hot reload: npm run dev   (Vite proxies /api to :8788)
```
Local secrets live in `.dev.vars` (git-ignored). Without `RESEND_API_KEY`, emails (OTP codes, reset links) are printed in the `cf:dev` console.

Tests (server must be running): `WRANGLER_LOG=<file with the cf:dev output> npm run test:api`
(use a fresh DB: stop the server, delete `.wrangler/state`, re-run `cf:migrate:local`).

## First deploy (Cloudflare dashboard)
`wrangler.toml` is for local dev only (it has no `pages_build_output_dir`, so Pages ignores it): bindings and secrets live in the dashboard.

1. **D1**: Storage & Databases → D1 → Create `sasha-crm`. Open it → Console → run `migrations/0001_init.sql`, then `migrations/0002_indexes.sql`.
2. **Pages project** (connected to this repo): build command `npm run build`, output directory `dist`.
3. Project → Settings → **Bindings** → Add → D1 database → variable name **`DB`** → `sasha-crm` (Production and Preview).
4. Project → Settings → **Variables and Secrets** (type: Secret): `AUTH_SECRET` (random, 32+ chars), `ADMIN_EMAILS` (comma list; these emails become admin once verified), `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Sasha Connect <no-reply@yourdomain.com>`).
5. Deployments → Retry deployment. Until the `DB` binding exists, the API answers `503 Database is not configured`.

Optional secrets: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (redirect URI `https://<your-domain>/api/auth/google/callback`; the button appears automatically), `GITHUB_TOKEN` and `ENABLE_GITHUB_PUSH=1` (admin → GitHub page; leave unset unless you need it — it lets an admin session write to the repo).

## Cutover checklist
- Work on the `cloudflare-migration` branch. **Pushing to `main` syncs into the Base44 builder** while the GitHub integration is on.
- Existing Base44 users cannot keep their passwords (hashes aren't exportable): everyone uses "Forgot password" once.
- Data: export each entity from Base44 and import keeping the original `id` values (relations like `partner_id` / `user_id` depend on them).
- Host the logo yourself (`AuthLayout.jsx`, `ReferralLanding.jsx` still point to media.base44.com).
- When live: delete `base44/`, disconnect the Base44 GitHub integration.
