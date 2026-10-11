import React, { useEffect, useState } from 'react';

// Shown instead of the app when the backend cannot serve requests (e.g. the D1 database is not bound yet).
// It asks /api/health which parts of the Cloudflare setup are missing and lists them.
const CHECKS = [
  { key: 'db', label: 'Database bound (D1 binding "DB")', hint: 'Add the [[d1_databases]] block with your real database_id to wrangler.toml, then redeploy.' },
  { key: 'migrated', label: 'Database tables created', hint: 'Run migrations/0001_init.sql, then 0002_indexes.sql, in the D1 console.' },
  { key: 'authSecret', label: 'AUTH_SECRET secret', hint: 'Pages → Settings → Variables and Secrets: add AUTH_SECRET (32+ random characters).' },
  { key: 'adminEmails', label: 'ADMIN_EMAILS secret', hint: 'Add ADMIN_EMAILS: the email(s) that become admin after verifying their address.' },
  { key: 'email', label: 'Email delivery (RESEND_API_KEY)', hint: 'Add RESEND_API_KEY and EMAIL_FROM so verification codes can be sent.' },
];

const valueOf = (health, key) => (key === 'db' || key === 'migrated' ? health[key] : health.secrets && health.secrets[key]);

export default function SetupNeeded({ error, onRetry }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => alive && setHealth(h))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const isSetup = error && error.status === 503;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">{isSetup ? 'Setup needed' : 'Something went wrong'}</h1>
        <p className="text-sm text-muted-foreground mb-5">
          {isSetup
            ? 'The app is deployed, but the Cloudflare backend is not fully configured yet.'
            : (error && error.message) || 'The app could not load your session.'}
        </p>

        {isSetup && health && (
          <ul className="space-y-3 mb-6">
            {CHECKS.map((c) => {
              const ok = Boolean(valueOf(health, c.key));
              return (
                <li key={c.key} data-ok={ok ? 'true' : 'false'} className="flex gap-3 text-sm">
                  <span aria-hidden className={ok ? 'text-green-600' : 'text-red-600'}>{ok ? '✓' : '✗'}</span>
                  <span>
                    <span className="font-medium">{c.label}</span>
                    {!ok && <span className="block text-muted-foreground">{c.hint}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {isSetup && !health && <p className="text-sm text-muted-foreground mb-6">Checking configuration…</p>}

        <div className="flex items-center gap-4">
          <button onClick={onRetry} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
          {isSetup && <a href="/api/health" className="text-sm text-muted-foreground underline">Technical status</a>}
        </div>
      </div>
    </div>
  );
}
