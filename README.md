# Sasha Connect: partner referral CRM on Cloudflare Pages

Frontend: Vite + React (`dist/`). Backend: Pages Functions (`functions/`) + D1 (SQLite).

```
functions/api/auth/     register · verify-otp · login · logout · me · password reset · Google (optional)
functions/api/entities/ REST over the entity store, with row-level security (functions/_lib/policies.generated.js)
functions/api/users/    admin: list / change role / invite
functions/api/fn/       business logic (functions/_fn/*): commissions, payouts, referral capture, GitHub
migrations/             D1 schema
src/api/client.js       frontend API client
scripts/smoke-test.mjs  145 API checks (auth, RLS, field-level security, referral codes, notifications, money rules, rate limits…)
scripts/no-email-test.mjs  10 checks of onboarding without e-mail delivery
tests/ui/               63 UI tests: the real <App/> in jsdom against the local server (auth, every admin/portal page, admin actions, partner link page, public form, accessibility scan)
```

## Local development
```bash
npm install
npm run build
npm run cf:migrate:local
npm run cf:dev            # http://localhost:8788  (API + built frontend, local D1)
# second terminal, for hot reload: npm run dev   (Vite proxies /api to :8788)
```
Local secrets: copy `.dev.vars.example` to `.dev.vars` (git-ignored). With `DEV_EMAIL_LOG=1`, emails (OTP codes, reset links) are printed in the `cf:dev` console.

Tests (start `npm run cf:dev` on a fresh DB first: stop it, delete `.wrangler/state`, run `npm run cf:migrate:local`):
```bash
WRANGLER_LOG=<file with the cf:dev output> npm run test:api   # API checks
WRANGLER_LOG=<file with the cf:dev output> npm run test:ui    # UI tests
```

## First deploy
`wrangler.toml` is the deployment config (`pages_build_output_dir = "dist"`), so the output directory never depends on a dashboard setting. `wrangler.local.toml` is for local dev only. Production operations (backups, restore, go-live checklist): see `docs/PRODUCTION.md`.

1. **D1**: Cloudflare → Storage & Databases → D1 → Create `sasha-crm`. Copy its **Database ID**. Open it → Console → run `migrations/0001_init.sql`, then `migrations/0002_indexes.sql`.
2. **Bind it**: in `wrangler.toml`, uncomment the `[[d1_databases]]` block and paste the real `database_id` (commit to `main`).
3. **Pages project** (connected to this repo): build command `npm run build`.
4. Project → Settings → **Variables and Secrets** (type: Secret): `AUTH_SECRET` (random, 32+ chars), `ADMIN_EMAILS` (comma list; these emails become admin once verified), `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Sasha Connect <no-reply@yourdomain.com>`).
5. Deployments → Retry deployment. Until the D1 binding exists, the API answers `503 Database is not configured`.
6. **Check it**: open `https://<your-site>/api/health`. It must show `"ok":true`; otherwise `db`, `migrated`, `secrets.*` tell you exactly what is missing (booleans only, no secret values).

**Workers Free plan:** password hashing (PBKDF2, 100k iterations) can exceed the 10 ms CPU limit ("Error 1102" on login/register). Either use the Workers Paid plan (recommended) or set `PBKDF2_ITERATIONS` (e.g. `20000`); existing hashes keep working.
Without `RESEND_API_KEY`, sign-up answers `503 Email delivery is not configured` instead of pretending a code was sent.

Optional secrets: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (redirect URI `https://<your-domain>/api/auth/google/callback`; the button appears automatically), `GITHUB_TOKEN` and `ENABLE_GITHUB_PUSH=1` (admin → GitHub page; leave unset unless you need it — it lets an admin session write to the repo).

