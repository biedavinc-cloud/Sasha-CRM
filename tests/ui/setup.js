import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// ---- browser APIs jsdom lacks (used by Radix, Recharts, etc.)
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
window.matchMedia ??= (q) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } })
window.scrollTo = () => {}
document.elementFromPoint ??= () => null
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

// ---- fetch with a cookie jar (a browser would do this for us); relative URLs hit the local Pages server
const ORIGIN = 'http://localhost:8788'
export const jar = new Map()
export const apiErrors = []
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' && input.startsWith('/') ? ORIGIN + input : input
  const headers = new Headers(init.headers || {})
  if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '))
  const res = await realFetch(url, { ...init, headers })
  if (res.status >= 400 && !(res.status === 401 && String(url).endsWith('/api/auth/me'))) {
    apiErrors.push(`${(init.method || 'GET')} ${String(url).replace(ORIGIN, '').slice(0, 90)} -> ${res.status}`)
  }
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';')
    const i = pair.indexOf('=')
    const k = pair.slice(0, i), v = pair.slice(i + 1)
    if (/Max-Age=0/i.test(c) || v === '') jar.delete(k)
    else jar.set(k, v)
  }
  return res
}

afterEach(() => cleanup())
