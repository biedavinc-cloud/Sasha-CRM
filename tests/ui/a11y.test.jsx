import { describe, test, beforeAll } from 'vitest'
import axe from 'axe-core'
import { cleanup, renderAt, act, expect, api, asUser, logoutJar, sleep } from './helpers.jsx'

// Automated accessibility checks (axe-core) on the screens people use most.
// jsdom cannot compute colours/layout, so those rules are off; everything structural is checked.
const RULES = { 'color-contrast': { enabled: false }, 'region': { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } }

async function scan(path) {
  cleanup(); renderAt(path)
  await act(async () => { await sleep(500) })
  const t0 = Date.now()
  while (Date.now() - t0 < 15000 && (document.querySelector('.animate-spin') || document.body.textContent.length < 100)) await act(async () => { await sleep(250) })
  await act(async () => { await sleep(300) })
  const res = await axe.run(document.body, { rules: RULES, resultTypes: ['violations'] })
  return res.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

let partnerCode
beforeAll(async () => {
  await asUser('admin@example.com')
  const p = (await api('GET', '/api/entities/Partner?limit=1')).data.items[0]
  partnerCode = p && p.referral_code
})

describe('accessibility (critical / serious violations)', () => {
  for (const [name, path, as] of [
    ['login', '/login', null], ['register', '/register', null], ['forgot password', '/forgot-password', null],
    ['admin dashboard', '/admin', 'admin@example.com'], ['partners', '/admin/partners', 'admin@example.com'],
    ['payouts', '/admin/payouts', 'admin@example.com'], ['settings', '/admin/settings', 'admin@example.com'], ['users', '/admin/users', 'admin@example.com'],
  ]) {
    test(name, async () => {
      if (as) await asUser(as); else logoutJar()
      expect(await scan(path)).toEqual([])
    })
  }
  test('public referral page', async () => {
    logoutJar()
    expect(await scan(`/r/${partnerCode || 'DEMO'}`)).toEqual([])
  })
})
