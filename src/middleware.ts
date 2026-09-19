import { NextResponse, type NextRequest } from 'next/server'

/**
 * CONTENT SECURITY POLICY
 *
 * A per-request nonce is generated, handed to Next.js so it can stamp its own
 * inline bootstrap scripts with it, and named in the policy. That means an
 * injected `<script>` cannot execute even if it reaches the page, because it
 * will not carry the nonce — which is the whole point of a CSP and is lost the
 * moment `'unsafe-inline'` appears in `script-src`.
 *
 * `style-src` does allow inline styles. React writes inline styles for
 * legitimate reasons and Next injects a stylesheet inline; the realistic risk
 * from CSS injection is far lower than from script injection, and a policy
 * nobody can ship is worth nothing.
 *
 * `strict-dynamic` lets Next's nonce-carrying bootstrap load the chunks it
 * needs without every chunk URL being enumerated here.
 */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    `default-src 'self'`,
    // Development needs eval for React Refresh. Production must not have it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    // Remote deal photography, and data: URIs for locally previewed uploads.
    `img-src 'self' data: blob: https://images.unsplash.com https://images.pexels.com`,
    // Stripe Checkout redirects away rather than embedding, so this is only
    // for the API calls the billing routes make on the server's behalf.
    `connect-src 'self' https://api.stripe.com`,
    `frame-src 'self' https://js.stripe.com https://hooks.stripe.com`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers } })

  const csp = contentSecurityPolicy(nonce, isDev)
  response.headers.set('Content-Security-Policy', csp)

  // HSTS is meaningless over plain HTTP and actively unhelpful in local
  // development, where it would pin localhost to HTTPS in the developer's
  // browser for two years.
  if (!isDev) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own static output and the favicon: those are
     * immutable assets that carry no policy of their own, and running the
     * middleware for each one costs a request for nothing.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
