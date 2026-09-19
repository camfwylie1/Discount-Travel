import { prisma } from '@/lib/db'
import { apiUser, hasMembership } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { outboundClickSchema } from '@/lib/validation'
import { clientIp, hashIp } from '@/lib/security/rateLimit'
import { track, trackRecommendation } from '@/lib/analytics/events'
import { flagDefaults, paywall } from '@/config/flags'
import { decideOpenMode, framedAttribution } from '@/lib/deals/handoff'

/**
 * OUTBOUND CLICK
 *
 * Records the click BEFORE handing the member to the provider, so the record
 * exists whether or not their page loads. This is the foundation of affiliate
 * reconciliation: user, deal, provider, timestamp, placement, campaign, url.
 *
 * Voyaj does not process the booking. This is a redirect, and the interface
 * says so plainly.
 */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'outboundClick', auth.user.id)
  if (limited) return limited

  if (flagDefaults.PAYWALL_ENABLED && !paywall.preview.allowOutboundClick && !hasMembership(auth.user)) {
    return fail('Opening a provider’s page is part of Voyaj membership.', 402)
  }

  const parsed = await parseBody(request, outboundClickSchema)
  if (!parsed.ok) return parsed.response

  const deal = await prisma.deal.findUnique({
    where: { id: parsed.data.dealId },
    select: {
      id: true, status: true, affiliateUrl: true, sourceUrl: true,
      provider: {
        select: {
          id: true, name: true, websiteUrl: true, active: true,
          compliance: { select: { framingPermitted: true, status: true } },
        },
      },
    },
  })
  if (!deal) return fail('That trip no longer exists.', 404)
  if (!deal.provider.active) {
    return fail('That provider is not available right now.', 410)
  }

  const target =
    (flagDefaults.AFFILIATE_TRACKING_ENABLED ? deal.affiliateUrl : null) ??
    deal.sourceUrl ??
    deal.provider.websiteUrl

  if (!target) {
    return fail('We do not have a link for this trip yet. Please try another.', 404)
  }

  // Only ever redirect to an absolute https URL we stored ourselves.
  let url: URL
  try {
    url = new URL(target)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad protocol')
  } catch {
    return fail('We could not open that link.', 500)
  }

  // How this page may be opened is the provider's decision, recorded by a
  // person on their compliance record, not something we infer from whether
  // their site happens to load in a frame.
  const handoff = decideOpenMode({
    providerName: deal.provider.name,
    framingPermitted: deal.provider.compliance?.framingPermitted ?? false,
    complianceStatus: deal.provider.compliance?.status ?? 'NOT_REVIEWED',
  })

  const [click, score] = await Promise.all([
    prisma.dealClick.create({
      data: {
        dealId: deal.id,
        providerId: deal.provider.id,
        userId: auth.user.id,
        outboundUrl: url.toString(),
        openedAs: handoff.mode,
        placement: parsed.data.placement ?? null,
        campaign: parsed.data.campaign ?? null,
        referralSource: request.headers.get('referer')?.slice(0, 500) ?? null,
        ipHash: hashIp(clientIp(request.headers)),
        userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
    }),
    prisma.matchScore.findUnique({
      where: { userId_dealId: { userId: auth.user.id, dealId: deal.id } },
      select: { score: true },
    }),
  ])

  await Promise.all([
    track('outbound_click', {
      userId: auth.user.id,
      properties: { dealId: deal.id, provider: deal.provider.name, placement: parsed.data.placement },
    }),
    trackRecommendation(auth.user.id, 'VIEW_PROVIDER', {
      dealId: deal.id,
      placement: parsed.data.placement,
      position: parsed.data.position,
      score: score?.score,
    }),
  ])

  return ok({
    url: url.toString(),
    provider: deal.provider.name,
    // The client uses these to decide between the in-app viewer and a new tab,
    // and to show whose site the member is actually looking at.
    openMode: handoff.mode,
    attribution: framedAttribution(deal.provider.name),
    handoffId: click.id,
  })
})
