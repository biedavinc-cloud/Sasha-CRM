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

## First deploy
```bash
npx wrangler login
npx wrangler d1 create sasha-crm                 # copy database_id into wrangler.toml
npm run cf:migrate:remote
npx wrangler pages project create sasha-crm --production-branch main
npx wrangler pages secret put AUTH_SECRET   --project-name sasha-crm   # openssl rand -base64 32
npx wrangler pages secret put ADMIN_EMAILS  --project-name sasha-crm   # comma list; these emails become admin once verified
npx wrangler pages secret put RESEND_API_KEY --project-name sasha-crm  # https://resend.com (verify your sending domain)
npx wrangler pages secret put EMAIL_FROM    --project-name sasha-crm   # e.g. "Sasha Connect <no-reply@yourdomain.com>"
npm run cf:deploy
```
Optional secrets: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (redirect URI: `https://<your-domain>/api/auth/google/callback`; the button appears automatically), `GITHUB_TOKEN` (admin → GitHub page).

Or connect the GitHub repo in the Cloudflare dashboard (build command `npm run build`, output `dist`) and add the secrets there.

## Cutover checklist
- Work on the `cloudflare-migration` branch. **Pushing to `main` syncs into the Base44 builder** while the GitHub integration is on.
- Existing Base44 users cannot keep their passwords (hashes aren't exportable): everyone uses "Forgot password" once.
- Data: export each entity from Base44 and import keeping the original `id` values (relations like `partner_id` / `user_id` depend on them).
- Host the logo yourself (`AuthLayout.jsx`, `ReferralLanding.jsx` still point to media.base44.com).
- When live: delete `base44/`, disconnect the Base44 GitHub integration.
