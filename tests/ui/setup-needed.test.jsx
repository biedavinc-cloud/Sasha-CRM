import { describe, test, afterEach, vi } from 'vitest'
import { renderAt, screen, userEvent, expect } from './helpers.jsx'

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('Backend not configured yet (what the site owner sees right after the first deploy)', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('shows a checklist built from /api/health instead of a blank page or a raw error', async () => {
    let meCalls = 0
    vi.stubGlobal('fetch', async (url) => {
      const u = String(url)
      if (u.includes('/api/auth/me')) { meCalls++; return json({ error: 'Database is not configured: add the D1 binding `DB`' }, 503) }
      if (u.includes('/api/health')) return json({ db: false, migrated: false, indexes: false, secrets: { authSecret: true, email: false, adminEmails: true }, ok: false }, 503)
      throw new Error('unexpected request ' + u)
    })
    renderAt('/login')
    await screen.findByText('Setup needed')
    const row = (label) => screen.getByText(label).closest('li')
    await screen.findByText(/Database bound/)
    expect(row(/Database bound/).dataset.ok).toBe('false')
    expect(row(/Database tables created/).dataset.ok).toBe('false')
    expect(row(/AUTH_SECRET/).dataset.ok).toBe('true')
    expect(row(/ADMIN_EMAILS/).dataset.ok).toBe('true')
    expect(row(/Email delivery/).dataset.ok).toBe('false')
    expect(screen.getByText(/wrangler\.toml/)).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    await vi.waitFor(() => expect(meCalls).toBeGreaterThan(1))
  })

  test('a non-setup server error shows a plain message with Try again', async () => {
    vi.stubGlobal('fetch', async (url) => {
      if (String(url).includes('/api/auth/me')) return json({ error: 'Internal server error' }, 500)
      return json({}, 200)
    })
    renderAt('/login')
    await screen.findByText('Something went wrong')
    expect(screen.getByText('Internal server error')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
