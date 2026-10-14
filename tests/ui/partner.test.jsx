import { describe, test, beforeAll } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { cleanup, renderAt, screen, waitFor, act, userEvent, expect, captureProblems, api, asUser, logoutJar, sleep, PW } from './helpers.jsx'

const ADMIN = 'admin@example.com'
const PARTNER = 'portal-partner@example.com'
const ids = {}

beforeAll(async () => {
  await asUser(PARTNER)
  const me = (await api('GET', '/api/auth/me')).data
  const req = await api('POST', '/api/entities/AccessRequest', { phone: '+971500009999', note: 'portal test', requested_role: 'user' })
  await asUser(ADMIN)
  await api('PATCH', `/api/entities/AccessRequest/${req.data.id}`, { status: 'approved' })
  const p = await api('POST', '/api/entities/Partner', { business_name: 'Palm Beauty Studio', user_id: me.id, status: 'active', partner_type: 'beauty_salon', contact_person: 'Dana', email: PARTNER, commission_percentage: 10, commission_basis: 'gross' })
  expect(p.status).toBe(201)
  ids.partner = p.data; ids.user = me
  logoutJar()
  const ref = await api('POST', '/api/fn/captureReferral', { referralCode: p.data.referral_code, clientName: 'Dana Client', clientPhone: '+971 55 123 0001' })
  expect(ref.status).toBe(200)
  await asUser(ADMIN)
  await api('PATCH', `/api/entities/Referral/${ref.data.referralId}`, { status: 'treatment_completed' })
  const c = await api('POST', '/api/fn/processCommission', { referralId: ref.data.referralId, grossAmount: 1500, eligibleAmount: 1500 })
  expect(c.status).toBe(200)
  await api('POST', '/api/fn/approveCommission', { commissionId: c.data.commission.id, action: 'approve' })
})

async function open(path) {
  cleanup(); renderAt(path)
  await act(async () => { await sleep(500) })
  const t0 = Date.now()
  while (Date.now() - t0 < 15000 && (document.querySelector('.animate-spin') || document.body.textContent.length < 150)) await act(async () => { await sleep(250) })
}

describe('Partner dashboard & link page', () => {
  test('the "Commission" column shows the commission (AED 150), never the treatment price (1,500)', async () => {
    const cap = captureProblems()
    await asUser(PARTNER)
    for (const path of ['/portal', '/portal/referrals']) {
      await open(path)
      await screen.findByText('Dana Client', {}, { timeout: 15000 })
      const row = screen.getByText('Dana Client').closest('tr')
      expect(row.textContent).toMatch(/150/)
      expect(row.textContent).not.toMatch(/1,?500/)
    }
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('referral link page: professional link, QR code, tracked links per channel, share buttons', async () => {
    const cap = captureProblems()
    await asUser(PARTNER)
    await open('/portal/link')
    const code = ids.partner.referral_code
    expect(code).toMatch(/^PALMBEAUTYSTU/)
    const link = `${window.location.origin}/r/${code}`
    expect((await screen.findByTestId('referral-link')).textContent).toBe(link)
    await waitFor(() => expect(document.querySelector('[data-testid="qr"] svg')).toBeTruthy(), { timeout: 10000 })
    for (const src of ['instagram', 'whatsapp', 'facebook', 'email', 'qr']) {
      expect(document.body.textContent).toContain(`${link}?utm_source=${src}&utm_medium=`)
    }
    const wa = screen.getByRole('link', { name: 'Share on WhatsApp' })
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(decodeURIComponent(wa.getAttribute('href'))).toContain(link)
    expect(screen.getByRole('link', { name: 'Share by email' }).getAttribute('href')).toMatch(/^mailto:/)
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('partner changes their own password from the Profile page', async () => {
    const cap = captureProblems()
    await asUser(PARTNER)
    await open('/portal/profile')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText('Current password'), 'not-my-password')
    await u.type(screen.getByLabelText('New password'), 'Fresh-Passw0rd!')
    await u.type(screen.getByLabelText('Confirm new password'), 'Fresh-Passw0rd!')
    await u.click(screen.getByRole('button', { name: 'Change password' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/current password is incorrect/i)

    for (const label of ['Current password', 'New password', 'Confirm new password']) await u.clear(screen.getByLabelText(label))
    await u.type(screen.getByLabelText('Current password'), PW)
    await u.type(screen.getByLabelText('New password'), 'Fresh-Passw0rd!')
    await u.type(screen.getByLabelText('Confirm new password'), 'Fresh-Passw0rd!')
    await u.click(screen.getByRole('button', { name: 'Change password' }))
    await screen.findByRole('status')
    logoutJar()
    expect((await api('POST', '/api/auth/login', { email: PARTNER, password: 'Fresh-Passw0rd!' })).status).toBe(200)
    expect(cap.problems).toEqual([]); cap.restore()
  })
})

describe('Public referral page (what a client sees)', () => {
  test('bad phone stays on the form with a clear message; a good one is accepted; double tap = one referral; bots store nothing', async () => {
    const cap = captureProblems()
    logoutJar()
    cleanup(); renderAt(`/r/${ids.partner.referral_code.toLowerCase()}`) // links are case-insensitive
    await screen.findByText(/Full Name/, {}, { timeout: 15000 })
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Full Name'), 'Sam Visitor')
    await u.type(screen.getByLabelText('Phone Number'), '123')
    await u.click(screen.getByRole('button', { name: 'Submit Referral' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/valid phone number/i)
    expect(screen.queryByText('Referral Link Invalid')).toBeNull()   // used to replace the whole form with "link invalid"

    await u.clear(screen.getByLabelText('Phone Number'))
    await u.type(screen.getByLabelText('Phone Number'), '+971 50 111 2222')
    await u.click(screen.getByRole('button', { name: 'Submit Referral' }))
    await screen.findByText('Thank You!', {}, { timeout: 15000 })

    // the same person again (e.g. refresh + resubmit) -> still one referral
    cleanup(); renderAt(`/r/${ids.partner.referral_code}`)
    await screen.findByText(/Full Name/, {}, { timeout: 15000 })
    await u.type(screen.getByLabelText('Full Name'), 'Sam Visitor')
    await u.type(screen.getByLabelText('Phone Number'), '+971501112222') // same number, written differently
    await u.click(screen.getByRole('button', { name: 'Submit Referral' }))
    await screen.findByText('Thank You!', {}, { timeout: 15000 })

    // a bot fills the hidden field: looks successful, stores nothing
    cleanup(); renderAt(`/r/${ids.partner.referral_code}`)
    await screen.findByText(/Full Name/, {}, { timeout: 15000 })
    await u.type(screen.getByLabelText('Full Name'), 'Bot Spam')
    await u.type(screen.getByLabelText('Phone Number'), '+971 50 999 8888')
    fireEvent.change(document.querySelector('input[name="website"]'), { target: { value: 'http://spam.example' } })
    await u.click(screen.getByRole('button', { name: 'Submit Referral' }))
    await screen.findByText('Thank You!', {}, { timeout: 15000 })

    await asUser(ADMIN)
    const list = (await api('GET', '/api/entities/Referral?limit=100')).data.items
    expect(list.filter((r) => r.client_name === 'Sam Visitor' && r.partner_id === ids.partner.id).length).toBe(1)
    expect(list.filter((r) => r.client_name === 'Bot Spam').length).toBe(0)
    expect(cap.problems).toEqual([]); cap.restore()
  })
})
