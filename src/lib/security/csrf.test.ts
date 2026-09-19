import { describe, expect, it } from 'vitest'
import { isSignatureAuthenticated, verifyRequestOrigin } from './csrf'

const APP = 'https://voyaj.example'

function req(
  method: string,
  headers: Record<string, string> = {},
  url = `${APP}/api/deals/save`,
) {
  return new Request(url, { method, headers: { host: 'voyaj.example', ...headers } })
}

describe('refusing requests from other sites', () => {
  it('allows a read whatever its origin', () => {
    // A GET changes nothing, so forging one achieves nothing.
    expect(verifyRequestOrigin(req('GET', { origin: 'https://evil.example' })).ok).toBe(true)
  })

  it('allows a same-origin write', () => {
    expect(verifyRequestOrigin(req('POST', { origin: APP })).ok).toBe(true)
  })

  it('refuses a write from another site', () => {
    const verdict = verifyRequestOrigin(req('POST', { origin: 'https://evil.example' }))
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/another site/i)
  })

  it('trusts Sec-Fetch-Site over the Origin header when the browser sends it', () => {
    expect(verifyRequestOrigin(req('POST', { 'sec-fetch-site': 'same-origin' })).ok).toBe(true)
    expect(
      verifyRequestOrigin(req('POST', { 'sec-fetch-site': 'cross-site', origin: APP })).ok,
    ).toBe(false)
  })

  it('refuses a write that names no origin at all', () => {
    // Every browser sends Origin on a state-changing request. Something that
    // does not is a script, and a script with a session cookie is the exact
    // thing being defended against.
    expect(verifyRequestOrigin(req('POST')).ok).toBe(false)
  })

  it('accepts the deployment under its own host, not only the configured URL', () => {
    // Preview deployments and local addresses must keep working without a
    // separate environment variable for each.
    const request = new Request('http://127.0.0.1:3000/api/deals/save', {
      method: 'POST',
      headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
    })
    expect(verifyRequestOrigin(request).ok).toBe(true)
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('checks %s', (method) => {
    expect(verifyRequestOrigin(req(method, { origin: 'https://evil.example' })).ok).toBe(false)
  })
})

describe('webhooks are exempt', () => {
  it('excludes the signature-authenticated webhook path', () => {
    // Stripe is a server. It has no origin to send, and it proves itself with
    // an HMAC signature instead.
    expect(isSignatureAuthenticated(`${APP}/api/webhooks/stripe`)).toBe(true)
    expect(isSignatureAuthenticated(`${APP}/api/deals/save`)).toBe(false)
  })
})
