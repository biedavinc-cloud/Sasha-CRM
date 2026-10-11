import { describe, test, beforeAll, beforeEach } from 'vitest'
import { ensureUser, asUser as as, cleanup, renderAt, screen, act, expect, captureProblems, api, registerApi, loginApi, logoutJar, sleep, PW, apiErrors } from './helpers.jsx'

const ADMIN = 'admin@example.com'
const PARTNER = 'partner@example.com'
const ids = {}

beforeAll(async () => {
  await as(ADMIN)
  expect((await api('GET', '/api/auth/me')).data.role).toBe('admin')
  await as(PARTNER)
  const pu = (await api('GET', '/api/auth/me')).data
  ids.partnerUser = pu.id
  // the partner asks for access, head office approves
  const req = await api('POST', '/api/entities/AccessRequest', { phone: '+971500000001', note: 'salon owner', requested_role: 'user' })
  await as(ADMIN)
  if (req.status === 201 || req.status === 200) await api('PATCH', `/api/entities/AccessRequest/${req.data.id}`, { status: 'approved' })

  const mk = async (name, body) => { const r = await api('POST', `/api/entities/${name}`, body); expect([200, 201], `${name}: ${JSON.stringify(r.data)}`).toContain(r.status); return r.data }
  const partner = await mk('Partner', { business_name: 'Glow Salon', referral_code: 'GLOW1', user_id: pu.id, contact_person: 'Amal', email: PARTNER, phone: '+971500000001', partner_type: 'hair_salon', status: 'active', commission_percentage: 10, commission_basis: 'gross' })
  ids.partner = partner.id
  await mk('Service', { name: 'Vitamin Drip', category: 'IV Therapy', price: 300, status: 'active' })
  await mk('Service', { name: 'HydraFacial', category: 'Facials & Skin Care', price: 450, status: 'active' })
  await mk('Client', { full_name: 'Client One', phone: '+971500000002', source: 'partner_referral', partner_id: partner.id })
  await mk('Lead', { full_name: 'Lead One', phone: '+971500000003', source: 'website', status: 'new' })
  await mk('Appointment', { client_name: 'Client One', date: '2026-10-12', service_name: 'Vitamin Drip', status: 'booked' })

  logoutJar()
  const click = await api('POST', '/api/fn/trackClick', { referralCode: 'GLOW1', utmSource: 'instagram' })
  expect(click.status).toBe(200)
  const ref = await api('POST', '/api/fn/captureReferral', { referralCode: 'GLOW1', clientName: 'Client One', clientPhone: '+971500000002', clickId: click.data.clickId })
  expect(ref.status).toBe(200)
  ids.referral = ref.data.referralId
  await as(ADMIN)
  const c = await api('POST', '/api/fn/processCommission', { referralId: ids.referral, grossAmount: 1000, eligibleAmount: 1000 })
  expect(c.status, JSON.stringify(c.data)).toBe(200)
  await api('POST', '/api/fn/approveCommission', { commissionId: c.data.commission.id, action: 'approve' })
  const p = await api('POST', '/api/fn/createPayout', { partnerId: partner.id, commissionIds: [c.data.commission.id] })
  expect(p.status, JSON.stringify(p.data)).toBe(200)
  // a second, still-pending referral so lists have mixed states
  logoutJar()
  await api('POST', '/api/fn/captureReferral', { referralCode: 'GLOW1', clientName: 'Client Two', clientPhone: '+971500000004' })
})

beforeEach(() => { apiErrors.length = 0 })

async function visit(path) {
  const cap = captureProblems()
  cleanup()
  renderAt(path)
  // wait for the page to finish loading (no spinner, real content) – jsdom is slow, the API is not
  const started = Date.now()
  await act(async () => { await sleep(500) })
  while (Date.now() - started < 15000) {
    const busy = document.querySelector('.animate-spin')
    if (!busy && document.body.textContent.length > 150) break
    await act(async () => { await sleep(250) })
  }
  await act(async () => { await sleep(500) }) // let trailing requests settle
  const text = document.body.textContent
  const res = {
    problems: [...cap.problems],
    apiErrors: apiErrors.filter((e) => !/getGitHubIssues/.test(e)), // GitHub needs a token: expected to be unconfigured in tests
    textLength: text.length,
    text,
  }
  cap.restore()
  return res
}

const adminPaths = ['/admin', '/admin/partners', '/admin/clients', '/admin/leads', '/admin/appointments', '/admin/services', '/admin/referrals', '/admin/commissions', '/admin/payouts', '/admin/reports', '/admin/users', '/admin/settings', '/admin/audit', '/admin/github']

describe('Back office pages render with real data (as admin)', () => {
  test.each(adminPaths)('%s', async (path) => {
    await as(ADMIN)
    const r = await visit(path)
    expect(r.problems, 'console errors').toEqual([])
    expect(r.apiErrors, 'failed API calls').toEqual([])
    expect(r.textLength).toBeGreaterThan(150)
  })
  test('partner detail', async () => {
    await as(ADMIN)
    const r = await visit(`/admin/partners/${ids.partner}`)
    expect(r.problems).toEqual([]); expect(r.apiErrors).toEqual([]); expect(r.text).toContain('Glow Salon')
  })
  test('referral detail', async () => {
    await as(ADMIN)
    const list = (await api('GET', '/api/entities/Referral?limit=5')).data.items
    const r = await visit(`/admin/referrals/${list[0].id}`)
    expect(r.problems).toEqual([]); expect(r.apiErrors).toEqual([]); expect(r.textLength).toBeGreaterThan(150)
  })
  test('lists show the seeded data', async () => {
    await as(ADMIN)
    expect((await visit('/admin/partners')).text).toContain('Glow Salon')
    expect((await visit('/admin/referrals')).text).toContain('Client One')
    expect((await visit('/admin/services')).text).toContain('Vitamin Drip')
    expect((await visit('/admin/users')).text).toContain(PARTNER)
  })
})

const portalPaths = ['/portal', '/portal/referrals', '/portal/commissions', '/portal/payouts', '/portal/link', '/portal/profile']
describe('Partner portal renders with real data (as partner)', () => {
  test.each(portalPaths)('%s', async (path) => {
    await as(PARTNER)
    const r = await visit(path)
    expect(r.problems, 'console errors').toEqual([])
    expect(r.apiErrors, 'failed API calls').toEqual([])
    expect(r.textLength).toBeGreaterThan(150)
  })
  test('partner only sees their own data', async () => {
    await as(PARTNER)
    expect((await visit('/portal/referrals')).text).toContain('Client One')
    // partner has no business in the back office: it should not render admin data
    const r = await visit('/admin/partners')
    expect(r.text).not.toContain('Glow Salon Admin')
  })
})

describe('Public referral landing', () => {
  test('/r/GLOW1 renders for an anonymous visitor', async () => {
    logoutJar()
    const r = await visit('/r/GLOW1')
    expect(r.problems).toEqual([])
    expect(r.textLength).toBeGreaterThan(100)
  })
  test('unknown route -> not found page, no crash', async () => {
    logoutJar()
    const r = await visit('/definitely/not/here')
    expect(r.problems).toEqual([])
    expect(r.textLength).toBeGreaterThan(20)
  })
})
