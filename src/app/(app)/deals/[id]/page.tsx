import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser, hasMembership } from '@/lib/auth/guards'
import { DEAL_INCLUDE, scoreOneDeal } from '@/lib/recommendations/service'
import { explainDealMatch } from '@/lib/recommendations/explain'
import { valueBandLabel, type DealValueResult } from '@/lib/recommendations/dealValue'
import { getDealSocialProof } from '@/lib/deals/socialProof'
import { MatchScoreRing } from '@/components/deals/MatchScoreRing'
import { RecommendationFeedback, SaveButton, ViewDealButton } from '@/components/deals/DealActions'
import { ShareDeal } from '@/components/deals/ShareDeal'
import { Alert, Badge, Card, CardBody, Divider } from '@/components/ui'
import { countryName } from '@/components/deals/DealCard'
import { formatMoneyCompact } from '@/config/pricing'
import { LivePrice, LiveIndicator } from '@/components/deals/LivePrice'
import { formatDate, formatDateRange, NOT_SPECIFIED, orNotSpecified, plural, timeAgo } from '@/lib/utils'
import { trackRecommendation, track } from '@/lib/analytics/events'
import { flagDefaults, paywall } from '@/config/flags'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const deal = await prisma.deal.findUnique({
    where: { id },
    select: {
      normalizedTitle: true, aiSummary: true, destinationCountry: true, destinationCity: true,
      images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
      slug: true,
    },
  })
  if (!deal) return { title: 'Trip not found' }
  const where = [deal.destinationCity, countryName(deal.destinationCountry)].filter(Boolean).join(', ')
  return {
    title: deal.normalizedTitle,
    description: deal.aiSummary ?? `A trip to ${where}.`,
    alternates: { canonical: `/deals/${deal.slug}` },
    openGraph: {
      title: deal.normalizedTitle,
      description: deal.aiSummary ?? undefined,
      images: deal.images[0]?.url ? [deal.images[0].url] : undefined,
      type: 'website',
    },
  }
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  const deal = await prisma.deal.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      ...DEAL_INCLUDE,
      inclusions: { orderBy: { sortOrder: 'asc' } },
      itinerary: { orderBy: { dayNumber: 'asc' } },
      departures: { orderBy: { departureDate: 'asc' }, take: 8 },
    },
  })
  if (!deal) notFound()

  const member = hasMembership(user)
  const locked = flagDefaults.PAYWALL_ENABLED && !member

  const [match, saved, social] = await Promise.all([
    user ? scoreOneDeal(user.id, deal) : Promise.resolve(null),
    user
      ? prisma.savedDeal.findUnique({
          where: { userId_dealId: { userId: user.id, dealId: deal.id } },
          select: { state: true },
        })
      : Promise.resolve(null),
    user ? getDealSocialProof(deal.id, user.id) : Promise.resolve(null),
  ])

  if (user) {
    void Promise.all([
      track('deal_opened', { userId: user.id, properties: { dealId: deal.id } }),
      trackRecommendation(user.id, 'CLICK', { dealId: deal.id, placement: 'detail', score: match?.score }),
    ]).catch(() => {})
  }

  const explanation = match ? explainDealMatch(match) : null
  const value = deal.valueComponents as unknown as DealValueResult | null
  const hero = deal.images[0]
  const included = deal.inclusions.filter((i) => i.kind === 'INCLUDED')
  const excluded = deal.inclusions.filter((i) => i.kind === 'EXCLUDED')
  const unavailable = deal.status !== 'ACTIVE'
  const attribution = deal.provider.compliance?.attributionRequired
    ? (deal.sourceAttribution ?? `Operated by ${deal.provider.name}`)
    : null

  return (
    <article className="pb-16">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative aspect-[16/10] w-full bg-ink-100 sm:aspect-[21/9]">
        {hero ? (
          <Image
            src={hero.url}
            alt={hero.alt ?? deal.normalizedTitle}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-400">
            The provider did not supply a photo
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/20 to-transparent" />

        <div className="absolute inset-x-0 bottom-0">
          <div className="container-page pb-6 sm:pb-8">
            <div className="flex flex-wrap gap-2">
              {deal.isDemoContent && <Badge variant="dark">Demonstration listing</Badge>}
              {unavailable && <Badge variant="berry">{statusLabel(deal.status)}</Badge>}
              {deal.provider.sponsored && <Badge variant="outline" className="border-white/50 bg-white/85">Sponsored placement</Badge>}
            </div>
            <p className="mt-3 text-sm font-medium uppercase tracking-wider text-terracotta-200">
              {[deal.destinationCity, deal.destinationRegion, countryName(deal.destinationCountry)]
                .filter(Boolean)
                .join(' · ') || 'Destination not specified'}
            </p>
            <h1 className="mt-1.5 max-w-3xl text-display-md text-white text-balance sm:text-display-lg">
              {deal.normalizedTitle}
            </h1>
            <p className="mt-2 text-white/80">{deal.provider.name}</p>
          </div>
        </div>
      </div>

      <div className="container-page">
        {deal.isDemoContent && (
          <Alert tone="warning" className="mt-6" title="This is demonstration content">
            This listing is sample inventory created for development and demonstration. It is not a
            real offer and cannot be booked.
          </Alert>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* ── Main column ─────────────────────────────────────────── */}
          <div className="min-w-0 space-y-10">
            {/* Key facts */}
            <section aria-label="Trip details">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <Fact label="Dates" value={deal.departureDate ? formatDateRange(deal.departureDate, deal.returnDate) : NOT_SPECIFIED} />
                <Fact label="Length" value={deal.durationNights ? plural(deal.durationNights, 'night') : NOT_SPECIFIED} />
                <Fact
                  label="Departs from"
                  value={deal.departureAirport ? `${deal.departureAirport.city} (${deal.departureAirport.iata})` : NOT_SPECIFIED}
                />
                <Fact
                  label="Group size"
                  value={
                    deal.groupSizeMax
                      ? `Up to ${deal.groupSizeMax}${deal.groupSizeMin ? `, from ${deal.groupSizeMin}` : ''}`
                      : NOT_SPECIFIED
                  }
                />
                <Fact label="Accommodation" value={orNotSpecified(deal.accommodationType)} />
                <Fact
                  label="Standard"
                  value={deal.accommodationQuality ? `${deal.accommodationQuality}-star` : NOT_SPECIFIED}
                />
                <Fact
                  label="Difficulty"
                  value={deal.physicalDifficulty === 'NOT_SPECIFIED' ? NOT_SPECIFIED : titleCase(deal.physicalDifficulty)}
                />
                <Fact label="Minimum age" value={deal.minAge ? `${deal.minAge}+` : NOT_SPECIFIED} />
              </dl>
            </section>

            {/* AI summary — labelled as ours, separate from the provider's words */}
            {deal.aiSummary && (
              <section className="rounded-card border border-ink-200 bg-white p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">In short</h2>
                  <Badge variant="neutral">Written by Voyaj</Badge>
                </div>
                <p className="mt-3 leading-relaxed text-ink-700 text-pretty">{deal.aiSummary}</p>
                <p className="mt-3 text-xs text-ink-500 text-pretty">
                  Summarised from the provider’s own listing. We never add details the provider did
                  not state.
                </p>
              </section>
            )}

            {/* Why it matches */}
            {explanation && match && (
              <section className="rounded-card border border-ink-200 bg-white p-5 sm:p-6">
                <div className="flex items-start gap-5">
                  <MatchScoreRing score={match.score} size={80} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{explanation.headline}</h2>
                    {explanation.confidenceNote && (
                      <p className="mt-1 text-sm text-ink-500 text-pretty">{explanation.confidenceNote}</p>
                    )}
                  </div>
                </div>

                {locked && !paywall.preview.showFullExplanation ? (
                  <div className="mt-5 rounded-xl bg-sand-100 p-4">
                    <p className="text-sm text-ink-700 text-pretty">
                      Join Voyaj to see exactly which parts of your profile this trip fits, and
                      where it does not.
                    </p>
                    <Link href="/upgrade" className="mt-2 inline-block text-sm font-medium text-terracotta-600 underline underline-offset-4">
                      See membership
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-6 sm:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-moss-700">
                        Why you’ll probably love this
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {[...explanation.loveReasons, ...explanation.fitReasons].slice(0, 7).map((reason) => (
                          <li key={reason} className="flex gap-2.5 text-[0.95rem] text-ink-700">
                            <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-moss-500" />
                            <span className="text-pretty">{reason}</span>
                          </li>
                        ))}
                        {explanation.loveReasons.length + explanation.fitReasons.length === 0 && (
                          <li className="text-sm text-ink-500">
                            Nothing stands out strongly either way for you here.
                          </li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-700">
                        Potential mismatch
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {explanation.mismatches.length > 0 ? (
                          explanation.mismatches.map((m) => (
                            <li key={m} className="flex gap-2.5 text-[0.95rem] text-ink-700">
                              <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                              <span className="text-pretty">{m}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-ink-500">Nothing obvious.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {user && !locked && (
                  <div className="mt-6 border-t border-ink-100 pt-4">
                    <RecommendationFeedback dealId={deal.id} />
                  </div>
                )}
              </section>
            )}

            {/* Provider's own description */}
            {deal.originalDescription && (
              <section>
                <h2 className="text-lg font-semibold">About this trip</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700 text-pretty">
                  {deal.originalDescription}
                </p>
                <p className="mt-2 text-xs text-ink-500">From {deal.provider.name}’s own listing.</p>
              </section>
            )}

            {/* Inclusions */}
            <section className="grid gap-8 sm:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">What’s included</h2>
                {included.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {included.map((item) => (
                      <li key={item.id} className="flex gap-2.5 text-[0.95rem] text-ink-700">
                        <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-moss-500" fill="currentColor" aria-hidden="true">
                          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
                        </svg>
                        <span className="text-pretty">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-500">{NOT_SPECIFIED}</p>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">What’s not included</h2>
                {excluded.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {excluded.map((item) => (
                      <li key={item.id} className="flex gap-2.5 text-[0.95rem] text-ink-600">
                        <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" fill="currentColor" aria-hidden="true">
                          <path d="M6.3 6.3a1 1 0 0 1 1.4 0L10 8.6l2.3-2.3a1 1 0 1 1 1.4 1.4L11.4 10l2.3 2.3a1 1 0 0 1-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 0 1-1.4-1.4L8.6 10 6.3 7.7a1 1 0 0 1 0-1.4Z" />
                        </svg>
                        <span className="text-pretty">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-500">{NOT_SPECIFIED}</p>
                )}
              </div>
            </section>

            {/* Itinerary */}
            {deal.itinerary.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold">Itinerary</h2>
                <ol className="mt-4 space-y-5 border-l border-ink-200 pl-6">
                  {deal.itinerary.map((day) => (
                    <li key={day.id} className="relative">
                      <span className="absolute -left-[1.85rem] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-500 text-[0.65rem] font-semibold text-white">
                        {day.dayNumber}
                      </span>
                      <h3 className="font-medium text-ink-900">{day.title}</h3>
                      {day.location && <p className="text-xs text-ink-500">{day.location}</p>}
                      {day.description && (
                        <p className="mt-1 text-sm leading-relaxed text-ink-600 text-pretty">{day.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Other departures */}
            {deal.departures.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold">Other departures</h2>
                <ul className="mt-3 divide-y divide-ink-100 rounded-card border border-ink-200 bg-white">
                  {deal.departures.map((departure) => (
                    <li key={departure.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>{formatDate(departure.departureDate)}</span>
                      <span className="tabular-nums text-ink-600">
                        {departure.priceCents ? formatMoneyCompact(departure.priceCents, deal.currency) : NOT_SPECIFIED}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Important info */}
            {(deal.cancellationPolicy || deal.importantInfo) && (
              <section>
                <h2 className="text-lg font-semibold">Important information</h2>
                {deal.cancellationPolicy && (
                  <div className="mt-3">
                    <h3 className="text-sm font-medium text-ink-800">Cancellation</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600 text-pretty">{deal.cancellationPolicy}</p>
                  </div>
                )}
                {deal.importantInfo && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-600 text-pretty">{deal.importantInfo}</p>
                )}
              </section>
            )}

            {/* Data quality — honest about what we do not know */}
            {deal.qualityIssues.length > 0 && (
              <section className="rounded-card border border-ink-200 bg-sand-100 p-5">
                <h2 className="text-sm font-semibold">What we do not know about this trip</h2>
                <ul className="mt-2 space-y-1 text-sm text-ink-600">
                  {deal.qualityIssues.map((issue) => (
                    <li key={issue}>· {issue}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-500 text-pretty">
                  Check the provider’s page for anything marked “Not specified”.
                </p>
              </section>
            )}
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardBody>
                {deal.salePriceCents !== null ? (
                  <>
                    <div className="flex items-baseline gap-2.5">
                      <LivePrice
                        dealId={deal.id}
                        initialPriceCents={deal.salePriceCents}
                        currency={deal.currency}
                        className="text-3xl font-semibold tabular-nums"
                        style={{ fontFamily: 'var(--font-display)' }}
                      />
                      {deal.regularPriceCents && deal.regularPriceCents > deal.salePriceCents && (
                        <span className="text-ink-400 line-through tabular-nums">
                          {formatMoneyCompact(deal.regularPriceCents, deal.currency)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5">
                      <LiveIndicator dealIds={[deal.id]} />
                    </p>
                    <p className="mt-1 text-sm text-ink-600">
                      {deal.pricePerPerson ? 'per person' : 'total'}
                      {deal.airfareIncluded === true && ', flights included'}
                      {deal.airfareIncluded === false && ', flights extra'}
                      {deal.airfareIncluded === null && ', flights not specified'}
                    </p>
                    {deal.singleSupplementCents && (
                      <p className="mt-0.5 text-xs text-ink-500">
                        Single supplement {formatMoneyCompact(deal.singleSupplementCents, deal.currency)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-lg text-ink-600">Price not specified</p>
                )}

                {/* Deal value, kept visibly separate from personality match */}
                {value?.score != null && (
                  <div className="mt-4 rounded-xl bg-sand-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-800">{valueBandLabel(value.band)}</span>
                      <span className="text-sm tabular-nums text-ink-600">{value.score}/100</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500 text-pretty">
                      Value is judged separately from how well this trip suits you.
                    </p>
                    {value.caveats?.length > 0 && (
                      <p className="mt-1.5 text-[0.68rem] text-ink-500 text-pretty">{value.caveats[0]}</p>
                    )}
                  </div>
                )}

                <div className="mt-5 space-y-2.5">
                  <ViewDealButton
                    dealId={deal.id}
                    providerName={deal.provider.name}
                    locked={locked && !paywall.preview.allowOutboundClick}
                  />
                  {user && (
                    <div className="flex gap-2">
                      <SaveButton
                        dealId={deal.id}
                        initialSaved={!!saved}
                        variant="button"
                        placement="detail"
                        className="flex-1"
                      />
                      {flagDefaults.SOCIAL_ENABLED && (
                        <ShareDeal dealId={deal.id} dealTitle={deal.normalizedTitle} locked={locked} />
                      )}
                    </div>
                  )}
                </div>

                <Divider className="my-5" />

                {/* Freshness and provenance */}
                <dl className="space-y-2 text-xs text-ink-500">
                  <div className="flex justify-between gap-3">
                    <dt>Last checked</dt>
                    <dd className="text-right text-ink-700">
                      {deal.sourceLastCheckedAt ? timeAgo(deal.sourceLastCheckedAt) : 'Unknown'}
                    </dd>
                  </div>
                  {deal.expiresAt && (
                    <div className="flex justify-between gap-3">
                      <dt>Offer ends</dt>
                      <dd className="text-right text-ink-700">{formatDate(deal.expiresAt)}</dd>
                    </div>
                  )}
                  {deal.bookingDeadline && (
                    <div className="flex justify-between gap-3">
                      <dt>Book by</dt>
                      <dd className="text-right text-ink-700">{formatDate(deal.bookingDeadline)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt>Data confidence</dt>
                    <dd className="text-right text-ink-700">{Math.round(deal.overallConfidence * 100)}%</dd>
                  </div>
                </dl>

                {/* The position this product depends on, stated where the
                    money decision is actually made rather than only in the
                    terms nobody opens. */}
                <div className="mt-4 rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-600 text-pretty">
                  <p>
                    <strong className="font-semibold text-ink-800">
                      Voyaj is a search service, not the seller.
                    </strong>{' '}
                    This price is taken from {deal.provider.name}&rsquo;s own listing and shown
                    with the time we last checked it. We do not set it and we are not a party to
                    your booking or responsible for your decision to buy.
                  </p>
                  <p className="mt-1.5">
                    Prices and availability change. The price that applies is the one on{' '}
                    {deal.provider.name}&rsquo;s site when you pay.{' '}
                    <Link href="/legal/deal-disclaimer" className="underline underline-offset-2">
                      Read the full disclaimer
                    </Link>
                    .
                  </p>
                </div>

                {attribution && (
                  <p className="mt-2 text-[0.68rem] text-ink-500">{attribution}</p>
                )}
              </CardBody>
            </Card>

            {/* Privacy-safe social proof — real counts only */}
            {social && (social.similarTravellersSaved || social.connectionsSaved || social.circleInterest) && (
              <Card className="mt-4">
                <CardBody className="space-y-1.5 text-sm text-ink-600">
                  {social.similarTravellersSaved && (
                    <p>{plural(social.similarTravellersSaved, 'traveller')} have saved this.</p>
                  )}
                  {social.connectionsSaved && (
                    <p>
                      {plural(social.connectionsSaved, 'person')} you are connected to{' '}
                      {social.connectionsSaved === 1 ? 'has' : 'have'} saved it.
                    </p>
                  )}
                  {social.circleInterest && (
                    <p>{plural(social.circleInterest, 'person')} in your circles are interested.</p>
                  )}
                </CardBody>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className={`mt-1 text-[0.95rem] ${value === NOT_SPECIFIED ? 'text-ink-400' : 'text-ink-900'}`}>
        {value}
      </dd>
    </div>
  )
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function statusLabel(status: string) {
  return (
    {
      POSSIBLY_EXPIRED: 'This offer may have ended',
      EXPIRED: 'This offer has ended',
      SOLD_OUT: 'Sold out',
      UNKNOWN: 'Availability unknown',
      ARCHIVED: 'No longer listed',
      DRAFT: 'Not published',
    }[status] ?? status
  )
}
