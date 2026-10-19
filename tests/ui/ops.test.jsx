import { describe, test, beforeAll } from 'vitest'
import { within } from '@testing-library/react'
import { cleanup, renderAt, screen, waitFor, act, userEvent, expect, captureProblems, api, asUser, logoutJar, sleep } from './helpers.jsx'

const ADMIN = 'admin@example.com'
const OPSP = 'ops-partner@example.com'
const ids = {}

async function setting(patch) {
  await asUser(ADMIN)
  const rows = (await api('GET', '/api/entities/ClinicSetting?q=' + encodeURIComponent(JSON.stringify({ setting_key: 'default' })))).data.items
  if (rows.length) return (await api('PATCH', `/api/entities/ClinicSetting/${rows[0].id}`, patch)).data
  return (await api('POST', '/api/entities/ClinicSetting', { setting_key: 'default', ...patch })).data
}
async function open(path) {
  cleanup(); renderAt(path)
  await act(async () => { await sleep(500) })
  const t0 = Date.now()
  while (Date.now() - t0 < 15000 && (document.querySelector('.animate-spin') || document.body.textContent.length < 150)) await act(async () => { await sleep(250) })
}

beforeAll(async () => {
  await asUser(OPSP)
  const me = (await api('GET', '/api/auth/me')).data
  const req = await api('POST', '/api/entities/AccessRequest', { phone: '+971507771234', requested_role: 'user' })
  await asUser(ADMIN)
  await api('PATCH', `/api/entities/AccessRequest/${req.data.id}`, { status: 'approved' })
  const p = (await api('POST', '/api/entities/Partner', { business_name: 'Ops Studio', user_id: me.id, status: 'active', email: OPSP, phone: '+971 50 777 1234', contact_person: 'Olga', commission_percentage: 10, commission_basis: 'gross' })).data
  ids.partner = p
  const mk = async (name, phone, gross) => {
    logoutJar()
    const ref = (await api('POST', '/api/fn/captureReferral', { referralCode: p.referral_code, clientName: name, clientPhone: phone })).data.referralId
    await asUser(ADMIN)
    await api('PATCH', `/api/entities/Referral/${ref}`, { status: 'treatment_completed' })
    const c = (await api('POST', '/api/fn/processCommission', { referralId: ref, grossAmount: gross, eligibleAmount: gross })).data.commission
    await api('POST', '/api/fn/approveCommission', { commissionId: c.id, action: 'approve' })
    return { ref, c }
  }
  const a = await mk('Ops Client One', '+971 55 700 0001', 1000)
  const b = await mk('Ops Client Two', '+971 55 700 0002', 600)
  ids.refOpen = (await (async () => { logoutJar(); const r = await api('POST', '/api/fn/captureReferral', { referralCode: p.referral_code, clientName: 'Ops Open Lead', clientPhone: '+971 55 700 0003' }); await asUser(ADMIN); return r.data.referralId })())
  const paid = (await api('POST', '/api/fn/createPayout', { partnerId: p.id, commissionIds: [a.c.id] })).data.payout
  await api('PATCH', `/api/entities/Payout/${paid.id}`, { status: 'paid', payment_reference: 'REF-777' })
  ids.pending = (await api('POST', '/api/fn/createPayout', { partnerId: p.id, commissionIds: [b.c.id] })).data.payout
})

describe('Payouts screen', () => {
  test('WhatsApp click-to-chat appears for paid payouts when enabled, using the template', async () => {
    const cap = captureProblems()
    await setting({ notify_whatsapp_on_payout: true, whatsapp_template: 'Hi {partner}, AED {amount} sent. Ref {reference}' })
    await asUser(ADMIN)
    await open('/admin/payouts')
    const link = await screen.findByRole('link', { name: 'WhatsApp' }, { timeout: 15000 })
    const href = link.getAttribute('href')
    expect(href).toMatch(/^https:\/\/wa\.me\/971507771234\?text=/)
    const text = decodeURIComponent(href.split('text=')[1])
    expect(text).toBe('Hi Ops Studio, AED 100 sent. Ref REF-777')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('no WhatsApp link when the switch is off', async () => {
    await setting({ notify_whatsapp_on_payout: false })
    await asUser(ADMIN)
    await open('/admin/payouts')
    await screen.findAllByText('Ops Studio', {}, { timeout: 15000 })
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull()
  })

  test('"Confirm Paid" needs a payment reference', async () => {
    await asUser(ADMIN)
    await open('/admin/payouts')
    const u = userEvent.setup()
    const row = (await screen.findByText(ids.pending.payout_id, {}, { timeout: 15000 })).closest('tr') // other pending payouts may exist
    await u.click(within(row).getByRole('button', { name: 'Mark Paid' }))
    const confirm = await screen.findByRole('button', { name: /Confirm Paid/ })
    expect(confirm.disabled).toBe(true)
    await u.type(screen.getByLabelText('Payment Reference'), 'TRX-1')
    expect(screen.getByRole('button', { name: /Confirm Paid/ }).disabled).toBe(false)
    await u.click(screen.getByRole('button', { name: /Confirm Paid/ }))
    await waitFor(async () => {
      const p = (await api('GET', `/api/entities/Payout/${ids.pending.id}`)).data
      expect(p.status).toBe('paid'); expect(p.payment_reference).toBe('TRX-1')
    }, { timeout: 15000 })
  })
})

describe('Other admin screens', () => {
  test('referral status list offers journey steps only (no paid / payable by hand)', async () => {
    const cap = captureProblems()
    await asUser(ADMIN)
    await open(`/admin/referrals/${ids.refOpen}`)
    const trigger = await screen.findByRole('combobox', {}, { timeout: 15000 })
    await userEvent.setup().click(trigger)
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(options.some((t) => /Contacted/i.test(t))).toBe(true)
    expect(options.some((t) => /^Paid$/i.test(t.trim()))).toBe(false)
    expect(options.some((t) => /Payable/i.test(t))).toBe(false)
    expect(options.some((t) => /Refunded/i.test(t))).toBe(false)
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('new partners start with the defaults saved in Settings', async () => {
    await setting({ default_commission_percentage: 15, default_commission_basis: 'gross' })
    await asUser(ADMIN)
    await open('/admin/partners')
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New Partner/ }, { timeout: 15000 }))[0])
    const field = (await screen.findByText('Commission %')).parentElement.querySelector('input')
    expect(field.value).toBe('15')
  })

  test('Users: admin resets a password and the person can sign in with it', async () => {
    const cap = captureProblems()
    await asUser(ADMIN)
    await open('/admin/users')
    const row = (await screen.findByText(OPSP, {}, { timeout: 15000 })).closest('tr')
    const u = userEvent.setup()
    await u.click(within(row).getByRole('button', { name: 'Reset password' }))
    await u.click(await screen.findByRole('button', { name: 'Generate password' }))
    const pw = (await screen.findByTestId('temp-password')).textContent
    expect(pw).toMatch(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/)
    logoutJar()
    expect((await api('POST', '/api/auth/login', { email: OPSP, password: pw })).status).toBe(200)
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('Settings page no longer pre-fills a made-up link domain', async () => {
    await asUser(ADMIN)
    await open('/admin/settings')
    const input = await screen.findByPlaceholderText('https://join.yourdomain.com')
    expect(input.value).toBe('')
  })
})

describe('Custom link domain', () => {
  test("partner link page uses the domain saved in Settings, and falls back to this site when removed", async () => {
    await setting({ referral_base_url: 'https://join.example.com' })
    await asUser(ADMIN) // the admin partner screen shows the same link the partner sees
    await open(`/admin/partners/${ids.partner.id}`)
    await waitFor(() => expect(document.body.textContent).toContain(`https://join.example.com/r/${ids.partner.referral_code}`), { timeout: 15000 })
    await setting({ referral_base_url: '' })
    await open(`/admin/partners/${ids.partner.id}`)
    await waitFor(() => expect(document.body.textContent).toContain(`${window.location.origin}/r/${ids.partner.referral_code}`), { timeout: 15000 })
  })
})

describe('Partner accounts created by head office', () => {
  test('a login linked to a Partner record reaches the portal without filing an access request', async () => {
    const cap = captureProblems()
    const email = 'linked-partner@example.com'
    await asUser(email)
    const me = (await api('GET', '/api/auth/me')).data
    await asUser(ADMIN)
    const p = (await api('POST', '/api/entities/Partner', { business_name: 'Linked Studio', user_id: me.id, status: 'active', email, contact_person: 'Lia' })).data
    expect(p.referral_code).toBeTruthy()
    await asUser(email)
    await open('/portal')
    expect(screen.queryByText('Request Access')).toBeNull()
    await waitFor(() => expect(document.body.textContent).toContain('Linked Studio'), { timeout: 15000 })
    expect(cap.problems).toEqual([]); cap.restore()
  })
})

describe('Legacy placeholder domain', () => {
  test('a saved made-up domain is not shown and does not change partner links', async () => {
    await setting({ referral_base_url: 'https://sasha.ae/r/' })
    await asUser(ADMIN)
    await open('/admin/settings')
    expect((await screen.findByPlaceholderText('https://join.yourdomain.com')).value).toBe('')
    await open(`/admin/partners/${ids.partner.id}`)
    await waitFor(() => expect(document.body.textContent).toContain(`${window.location.origin}/r/${ids.partner.referral_code}`), { timeout: 15000 })
    expect(document.body.textContent).not.toContain('sasha.ae')
    await setting({ referral_base_url: '' })
  })
})
