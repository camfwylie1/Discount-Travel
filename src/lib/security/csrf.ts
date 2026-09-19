/**
 * CROSS-SITE REQUEST FORGERY
 *
 * Voyaj's session cookie is SameSite=Lax, which already stops a cross-site
 * form post from carrying it. That is most of the defence, but it rests
 * entirely on the browser getting SameSite right, and it does nothing about a
 * same-site subdomain that is not ours.
 *
 * So state-changing requests are also checked at the server: the request must
 * come from our own origin, and it must say so.
 *
 * ORIGIN CHECKING RATHER THAN A TOKEN
 *
 * A double-submit token would mean threading a value through every form and
 * every fetch, with a real chance of a route quietly ending up unprotected
 * because somebody forgot. This check is in the wrapper every route already
 * goes through, so a new route is protected by existing. For a same-origin
 * JSON API that is the stronger arrangement.
 *
 * `Origin` is sent by every browser on every POST, PUT, PATCH and DELETE, so a
 * missing Origin on a state-changing request is not a browser — it is a
 * script, and it is refused.
 */

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export interface CsrfVerdict {
  ok: boolean
  reason?: string
}

/**
 * Builds the set of origins this deployment will accept.
 *
 * NEXT_PUBLIC_APP_URL is the deployment's own address. The request's own host
 * is also accepted so that preview deployments, a local IP and localhost all
 * work without a separate variable each — the point is to refuse OTHER sites,
 * not to refuse ourselves under a different name.
 */
function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>()

  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) {
    try {
      origins.add(new URL(configured).origin)
    } catch {
      // A malformed app URL should not disable the check.
    }
  }

  // The Host header, as the request actually arrived. Behind a proxy that
  // rewrites Host this is the public name, which is what we want to compare.
  const host = request.headers.get('host')
  if (host) {
    origins.add(`https://${host}`)
    origins.add(`http://${host}`)
  }

  return origins
}

export function verifyRequestOrigin(request: Request): CsrfVerdict {
  if (!STATE_CHANGING.has(request.method.toUpperCase())) return { ok: true }

  // Stripe and other server-to-server callers have no Origin and no cookie, so
  // they cannot be the target of this attack. Webhooks authenticate by
  // signature and are excluded by path below.
  const origin = request.headers.get('origin')

  // Browsers that send it give us a definitive answer with no parsing.
  const site = request.headers.get('sec-fetch-site')
  if (site === 'same-origin' || site === 'none') return { ok: true }
  if (site === 'cross-site') {
    return { ok: false, reason: 'This request came from another site.' }
  }

  if (!origin) {
    return {
      ok: false,
      reason: 'This request did not identify where it came from.',
    }
  }

  if (!allowedOrigins(request).has(origin)) {
    return { ok: false, reason: 'This request came from another site.' }
  }

  return { ok: true }
}

/**
 * Paths that authenticate by signature rather than by cookie, and therefore
 * must not be subject to an origin check — the caller is a server, not a
 * browser, and has no origin to give.
 */
export function isSignatureAuthenticated(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith('/api/webhooks/')
  } catch {
    return false
  }
}
