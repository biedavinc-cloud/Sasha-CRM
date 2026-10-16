import { describe, test } from 'vitest'
import { cleanup, renderAt, screen, waitFor, act, userEvent, expect, captureProblems, api, otpFor, resetTokenFor, registerApi, loginApi, logoutJar, sleep, PW } from './helpers.jsx'

const ADMIN = 'ui-admin@example.com'
const NEW_PW = 'Brand-New-Pass1'
let admin

describe('Auth pages (real <App/> in jsdom against the local Pages server)', () => {
  test('login page renders and rejects a wrong password', async () => {
    const cap = captureProblems()
    renderAt('/login')
    await screen.findByText('Welcome back')
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Email'), 'nobody@example.com')
    await u.type(screen.getByLabelText('Password'), 'wrong-pass-123')
    await u.click(screen.getByRole('button', { name: 'Log in' }))
    await screen.findByText('Invalid email or password')
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('register -> email code -> lands in the back office (bootstrap admin)', async () => {
    const cap = captureProblems()
    logoutJar()
    renderAt('/register')
    await screen.findByText('Create your account')
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Email'), ADMIN)
    await u.type(screen.getByLabelText('Password'), PW)
    await u.type(screen.getByLabelText('Confirm Password'), PW)
    await u.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByText('Verify your email')
    const code = await otpFor(ADMIN)
    expect(code).toMatch(/^\d{6}$/)
    const otp = document.querySelector('input[autocomplete="one-time-code"]')
    await u.type(otp, code)
    await u.click(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(window.location.pathname).toBe('/admin'), { timeout: 20000 })
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(200), { timeout: 20000 }) // pages load on demand
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('logout, then log in through the form', async () => {
    const cap = captureProblems()
    logoutJar()
    renderAt('/admin') // protected: must bounce to /login
    await screen.findByText('Welcome back')
    expect(window.location.pathname).toBe('/login')
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Email'), ADMIN)
    await u.type(screen.getByLabelText('Password'), PW)
    await u.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(window.location.pathname).toBe('/admin'), { timeout: 20000 })
    admin = true
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('forgot password -> reset page renders -> new password works, old one does not', async () => {
    const cap = captureProblems()
    logoutJar()
    renderAt('/forgot-password')
    await screen.findByText('Reset password')
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Email address'), ADMIN)
    await u.click(screen.getByRole('button', { name: 'Send reset link' }))
    let token
    await waitFor(async () => { token = await resetTokenFor(ADMIN); expect(token).toBeTruthy() }, { timeout: 15000 })

    renderAt(`/reset-password?token=${token}`)   // used to crash: `Lock` icon was never imported
    await screen.findByText('New password')
    await u.type(screen.getByLabelText('New Password'), NEW_PW)
    await u.type(screen.getByLabelText('Confirm Password'), NEW_PW)
    await u.click(screen.getByRole('button', { name: 'Reset password' }))
    await waitFor(async () => {
      const r = await api('POST', '/api/auth/login', { email: ADMIN, password: NEW_PW })
      expect(r.status).toBe(200)
    }, { timeout: 15000 })
    logoutJar()
    const old = await api('POST', '/api/auth/login', { email: ADMIN, password: PW })
    expect(old.status).toBe(401)
    // restore the shared test password for later suites
    await loginApi(ADMIN, NEW_PW)
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('reset page with a missing/invalid token explains the problem', async () => {
    logoutJar()
    renderAt('/reset-password')
    await screen.findByText('Invalid reset link')
  })

  test('unverified account that tries to log in is sent to the code screen', async () => {
    const cap = captureProblems()
    logoutJar()
    const email = 'unverified@example.com'
    await api('POST', '/api/auth/register', { email, password: PW })
    renderAt('/login')
    await screen.findByText('Welcome back')
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Email'), email)
    await u.type(screen.getByLabelText('Password'), PW)
    await u.click(screen.getByRole('button', { name: 'Log in' }))
    await screen.findByText('Verify your email', {}, { timeout: 15000 })
    const code = await otpFor(email)
    await u.type(document.querySelector('input[autocomplete="one-time-code"]'), code)
    await u.click(screen.getByRole('button', { name: 'Verify' }))
    // a regular user without an approved request must see the access request form
    await screen.findByText('Request Access', {}, { timeout: 20000 })
    expect(cap.problems).toEqual([]); cap.restore()
  })

  test('access request -> pending screen -> admin approves -> user reaches the portal', async () => {
    const cap = captureProblems()
    const email = 'unverified@example.com'
    const u = userEvent.setup()
    // still logged in as that user from the previous test; mount fresh
    renderAt('/')
    await screen.findByText('Request Access', {}, { timeout: 15000 })
    await u.type(screen.getByPlaceholderText('+971 50 123 4567'), '+971500000000')
    await u.click(screen.getByRole('button', { name: 'Submit Access Request' }))
    await screen.findByText('Awaiting Head Office Approval', {}, { timeout: 15000 })

    await loginApi(ADMIN, NEW_PW)
    const reqs = (await api('GET', '/api/entities/AccessRequest?q=' + encodeURIComponent(JSON.stringify({ user_email: email })))).data.items
    expect(reqs.length).toBe(1)
    expect(reqs[0].status).toBe('pending')
    await api('PATCH', `/api/entities/AccessRequest/${reqs[0].id}`, { status: 'approved' })

    await loginApi(email)
    cleanup()
    renderAt('/')
    await waitFor(() => expect(screen.queryByText('Request Access')).toBeNull(), { timeout: 15000 })
    await act(async () => { await sleep(600) })
    expect(screen.queryByText('Awaiting Head Office Approval')).toBeNull()
    expect(cap.problems).toEqual([]); cap.restore()
  })
})
