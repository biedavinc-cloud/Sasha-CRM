import fs from 'node:fs'
import React from 'react'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, expect } from 'vitest'
import App from '@/App.jsx'
import { jar, apiErrors } from './setup.js'

export const LOG = process.env.WRANGLER_LOG || '/tmp/wrangler.log'
export const PW = 'Correct-Horse-9'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function api(method, path, body) {
  const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

export async function mailValue(to, re) {
  await sleep(300)
  const blocks = fs.readFileSync(LOG, 'utf8').split('[email:dev]').filter((b) => b.includes(`to=${to} `))
  for (const b of blocks.reverse()) { const m = re.exec(b); if (m) return m[1] }
  return null
}
export const otpFor = (e) => mailValue(e, /verification code is (\d{6})/)
export const resetTokenFor = (e) => mailValue(e, /token=([A-Za-z0-9_%-]+)/)

export function logoutJar() { jar.clear() }
export async function loginApi(email, password = PW) {
  jar.clear()
  const r = await api('POST', '/api/auth/login', { email, password })
  if (r.status !== 200) throw new Error(`API login failed for ${email}: ${JSON.stringify(r.data)}`)
}
export async function registerApi(email, password = PW) {
  jar.clear()
  await api('POST', '/api/auth/register', { email, password })
  const code = await otpFor(email)
  const r = await api('POST', '/api/auth/verify-otp', { email, otpCode: code })
  if (r.status !== 200) throw new Error(`API verify failed for ${email}: ${JSON.stringify(r.data)}`)
  return r.data.user
}

// Collects anything that would make a user see a blank page or a broken screen
export function captureProblems() {
  const problems = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    const msg = args.map((a) => (a instanceof Error ? a.stack || a.message : String(a))).join(' ')
    if (/Not implemented: navigation|not wrapped in act|Warning: (An update|Each child|validateDOMNesting|React does not recognize|Received `|Invalid prop|Function components)/i.test(msg)) return
    problems.push(msg.slice(0, 400))
  })
  return { problems, restore: () => spy.mockRestore() }
}

export function renderAt(path) {
  window.history.pushState({}, '', path)
  return render(<App />)
}
export { render, screen, waitFor, act, cleanup, userEvent, expect, apiErrors }

const saved = {}   // one login per account (the login endpoint is rate limited, like in production)
export async function ensureUser(email) {
  for (const pw of ['Brand-New-Pass1', PW]) {
    logoutJar()
    const r = await api('POST', '/api/auth/login', { email, password: pw })
    if (r.status === 200) return r.data.user
    if (r.status === 429) throw new Error('rate limited while preparing the test session')
  }
  return registerApi(email)
}
export async function asUser(email) {
  if (!saved[email]) { await ensureUser(email); saved[email] = new Map(jar) }
  jar.clear(); for (const [k, v] of saved[email]) jar.set(k, v)
}
export const sessionsSaved = saved
