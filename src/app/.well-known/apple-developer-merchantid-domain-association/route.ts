/**
 * APPLE PAY DOMAIN VERIFICATION
 *
 * Before Apple will show the Apple Pay sheet on a site, the domain has to be
 * registered — in Stripe's dashboard under Settings → Payments → Apple Pay —
 * and Apple then fetches this exact path to confirm the site is really ours.
 *
 * Stripe issues the file's contents when the domain is registered. Paste it
 * into APPLE_PAY_DOMAIN_ASSOCIATION and it is served from here; that keeps a
 * per-environment verification token out of the repository, where it would be
 * wrong for every deployment but one.
 *
 * Without this, the hosted Stripe Checkout page still offers Apple Pay — that
 * page lives on Stripe's own verified domain. It is only the in-page wallet
 * button that needs our domain verified.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const association = process.env.APPLE_PAY_DOMAIN_ASSOCIATION

  if (!association) {
    // A 404 is the honest answer: this domain is not verified for Apple Pay.
    // Serving an empty 200 would make Apple's check fail in a way that is much
    // harder to diagnose than a missing file.
    return new Response(
      'Apple Pay domain verification is not configured for this deployment.\n' +
        'Register the domain in Stripe (Settings → Payments → Apple Pay) and put the\n' +
        'file Stripe gives you into APPLE_PAY_DOMAIN_ASSOCIATION.\n',
      { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }

  return new Response(association, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
