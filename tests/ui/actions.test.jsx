import { describe, test } from 'vitest'
import { cleanup, renderAt, screen, waitFor, act, userEvent, expect, captureProblems, api, asUser, registerApi, logoutJar, sleep, resetTokenFor, PW } from './helpers.jsx'

const ADMIN = 'admin@example.com'

describe('Admin actions through the real screens', () => {
  test('Users: approve a pending access request as Partner', async () => {
    const cap = captureProblems()
    const email = 'applicant@example.com'
    logoutJar()
    const user = await registerApi(email)
    const r = await api('POST', '/api/entities/AccessRequest', { phone: '+971500001111', note: 'new salon', requested_role: 'user' })
    expect(r.status).toBe(201)
    await asUser(ADMIN)
    cleanup(); renderAt('/admin/users')
    const btn = await screen.findByRole('button', { name: 'Approve as Partner' }, { timeout: 20000 })
    await userEvent.setup().click(btn)
    await waitFor(async () => {
      const ar = (await api('GET', `/api/entities/AccessRequest/${r.data.id}`)).data
      expect(ar.status).toBe('approved')
    }, { timeout: 15000 })
    const users = (await api('GET', '/api/users')).data.items
    expect(users.find((u) => u.id === user.id).role).toBe('user')
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('Users: invite -> set-password link -> invited person can log in (still needs approval)', async () => {
    const cap = captureProblems()
    const email = 'invited@example.com'
    await asUser(ADMIN)
    cleanup(); renderAt('/admin/users')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: /Invite User/ }, { timeout: 20000 }))
    await u.type(await screen.findByPlaceholderText('name@example.com'), email)
    await u.click(screen.getByRole('button', { name: 'Send Invite' }))
    let token
    await waitFor(async () => { token = await resetTokenFor(email); expect(token).toBeTruthy() }, { timeout: 15000 })
    // the invitee opens the emailed link and chooses a password
    logoutJar(); cleanup()
    renderAt(`/reset-password?token=${token}`)
    await screen.findByText('New password')
    await u.type(screen.getByLabelText('New Password'), PW)
    await u.type(screen.getByLabelText('Confirm Password'), PW)
    await u.click(screen.getByRole('button', { name: 'Reset password' }))
    await waitFor(async () => { expect((await api('POST', '/api/auth/login', { email, password: PW })).status).toBe(200) }, { timeout: 15000 })
    // not approved yet -> no data access
    expect((await api('GET', '/api/entities/Partner')).status).toBe(403)
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('Partners: create a partner through the dialog (creates the portal user too)', async () => {
    const cap = captureProblems()
    await asUser(ADMIN)
    cleanup(); renderAt('/admin/partners')
    const u = userEvent.setup()
    const open = await screen.findAllByRole('button', { name: /New Partner/ }, { timeout: 20000 })
    await u.click(open[0])
    await u.type(await screen.findByPlaceholderText('Beauty Lounge JVC'), "O'Brien Beauty")
    await u.type(screen.getByPlaceholderText('partner@example.com'), 'obrien@example.com')
    await u.click(screen.getByRole('button', { name: 'Create Partner' }))
    let partner
    await waitFor(async () => {
      const list = (await api('GET', '/api/entities/Partner?q=' + encodeURIComponent(JSON.stringify({ business_name: "O'Brien Beauty" })))).data.items
      expect(list.length).toBe(1); partner = list[0]
    }, { timeout: 15000 })
    expect(partner.referral_code).toBeTruthy()
    const users = (await api('GET', '/api/users')).data.items
    const invitee = users.find((x) => x.email === 'obrien@example.com')
    expect(invitee, 'portal user created by the invite').toBeTruthy()
    expect(partner.user_id).toBe(invitee.id)
    expect(cap.problems).toEqual([]); cap.restore()
  })
})
