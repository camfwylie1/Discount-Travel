import Link from 'next/link'
import { prisma } from '@/lib/db'
import { brand } from '@/config/brand'
import { formatMoneyCompact, membership } from '@/config/pricing'
import { Badge, LinkButton } from '@/components/ui'
import { CANADIAN_GATEWAYS } from '@/lib/taxonomy/airports'
import { RadarChart } from '@/components/personality/RadarChart'
import { MatchScoreRing } from '@/components/deals/MatchScoreRing'

export const revalidate = 300

/**
 * LANDING PAGE
 *
 * Numbers shown here are read from the live database. Where a figure would be
 * marketing invention, we do not show one.
 */
export default async function LandingPage() {
  const [dealCount, providerCount, destinationCount, cheapest] = await Promise.all([
    prisma.deal.count({ where: { status: 'ACTIVE' } }),
    prisma.provider.count({ where: { active: true } }),
    prisma.destination.count({ where: { kind: 'COUNTRY', active: true } }),
    prisma.deal.findFirst({
      where: { status: 'ACTIVE', salePriceCents: { not: null } },
      orderBy: { salePriceCents: 'asc' },
      select: { salePriceCents: true },
    }),
  ])

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=2000&q=75')",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/75 via-ink-950/60 to-ink-950/85" aria-hidden="true" />

        <div className="container-page py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white backdrop-blur">
              Now open to travellers leaving from Canada
            </Badge>
            <h1 className="mt-6 text-display-lg text-white text-balance sm:text-display-xl lg:text-display-2xl">
              {brand.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85 text-pretty sm:text-xl">
              {brand.subhead}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/signup" size="lg">
                Join free — find your people
              </LinkButton>
              <LinkButton
                href="#how-it-works"
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:border-white/60"
              >
                See how it works
              </LinkButton>
            </div>
            <p className="mt-5 text-sm text-white/70">
              Your profile, your travel personality and finding people are free. Full membership
              is {formatMoneyCompact(membership.priceCents)} a year.
            </p>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/55 text-pretty">
              Voyaj is a social network and a travel search service. Trips are sold by the travel
              companies we link to — we never sell travel and are not part of any booking.
            </p>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-6 border-t border-white/20 pt-8 sm:grid-cols-4">
            {[
              { value: dealCount.toLocaleString('en-CA'), label: 'trips in the marketplace' },
              { value: providerCount.toString(), label: 'travel providers' },
              { value: destinationCount.toString(), label: 'countries' },
              { value: `${CANADIAN_GATEWAYS.length}`, label: 'Canadian gateways' },
            ].map((stat) => (
              // The label is the <dt> and the number is the <dd>, which is what
              // the pairing actually means. Reversing the column paints the
              // number on top without duplicating the label into an extra
              // sr-only node, which made a screen reader read it twice.
              <div key={stat.label} className="flex flex-col-reverse">
                <dt className="mt-1 text-xs text-white/65 sm:text-sm">{stat.label}</dt>
                <dd
                  className="text-2xl font-semibold text-white sm:text-3xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── THE PROBLEM ───────────────────────────────────────────────── */}
      <section className="border-b border-ink-200 bg-white py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-terracotta-500">
              The problem
            </p>
            <h2 className="mt-4 text-display-md text-balance sm:text-display-lg">
              The hardest part of travel is who you go with
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-600 text-pretty">
              Every travel site asks <em>where do you want to go?</em> None of them ask who with —
              and two people with the same budget and the same two weeks off can have completely
              incompatible ideas about what makes a great trip.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Luxury hotels, restaurants, wineries, spas', tint: 'bg-gold-100 text-gold-700' },
              { title: 'Mountains, hiking, hostels, early mornings', tint: 'bg-moss-100 text-moss-700' },
              { title: 'Architecture, museums, history, cafés', tint: 'bg-ocean-100 text-ocean-700' },
              { title: 'Beaches, festivals, clubs, big groups', tint: 'bg-terracotta-100 text-terracotta-700' },
            ].map((persona, i) => (
              <div key={persona.title} className={`rounded-card p-6 ${persona.tint}`}>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  Traveller {i + 1}
                </span>
                <p className="mt-3 text-[0.95rem] font-medium leading-snug">{persona.title}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-lg text-ink-700 text-pretty">
            Same budget. Same dates. Four completely different holidays.{' '}
            <strong className="font-semibold text-ink-900">
              {brand.name} starts by understanding what kind of traveller you are.
            </strong>
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-terracotta-500">
              How it works
            </p>
            <h2 className="mt-4 text-display-md text-balance sm:text-display-lg">
              Four steps, about six minutes
            </h2>
          </div>

          <ol className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                title: 'Tell us how you travel',
                body: 'A short visual quiz, not a form. Scenario questions and quick preference cards across activities, food, culture, social style and comfort.',
              },
              {
                step: '02',
                title: 'Meet your travel personality',
                body: 'We turn your answers into a Travel DNA profile you can share, edit and change any time.',
              },
              {
                step: '03',
                title: 'Find your people',
                body: 'Meet travellers who actually fit how you travel, build circles, and plan trips together — with the disagreements named out loud instead of averaged away.',
              },
              {
                step: '04',
                title: 'We go and find the trip',
                body: 'We search the travel companies and rank what they have published against what your group wants. Every score comes with its reasons, and you book with the provider.',
              },
            ].map((item) => (
              <li key={item.step}>
                <span
                  className="text-3xl font-semibold text-terracotta-300"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600 text-pretty">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── TRAVEL PERSONALITY ────────────────────────────────────────── */}
      <section id="personality" className="scroll-mt-20 border-y border-ink-200 bg-white py-20 sm:py-28">
        <div className="container-page">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-terracotta-500">
                Travel personality
              </p>
              <h2 className="mt-4 text-display-md text-balance sm:text-display-lg">
                Your Travel DNA, in ten dimensions
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-600 text-pretty">
                We measure what actually matters when you travel — adventure, food, culture,
                nightlife, comfort, spontaneity and more — on a scale where{' '}
                <strong className="font-semibold text-ink-900">
                  “not for me” genuinely counts against a trip
                </strong>
                , rather than just being ignored.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  'Tell us you avoid partying and we will rank party trips lower, not just stop recommending them.',
                  'Hard constraints like budget and departure city remove options. Preferences change the order.',
                  'Change your mind any time — nothing is locked in after onboarding.',
                ].map((line) => (
                  <li key={line} className="flex gap-3 text-[0.95rem] text-ink-700">
                    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-moss-500" fill="currentColor" aria-hidden="true">
                      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0Z" />
                    </svg>
                    <span className="text-pretty">{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-ink-500 text-pretty">
                This is travel personalisation, not psychology. It describes how you like to
                travel — nothing more.
              </p>
            </div>

            <div className="rounded-card border border-ink-200 bg-sand-50 p-8 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
                Example profile
              </p>
              <h3 className="mt-1 text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
                The Social Adventurer
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600 text-pretty">
                “Happiest when a trip has a bit of everything: a mountain in the morning, local
                food in the afternoon and a bar full of new people at night.”
              </p>
              <div className="mt-6">
                <RadarChart
                  values={{
                    adventure: 84, outdoors: 78, activity: 72, culture: 66, food: 88,
                    social: 80, nightlife: 55, luxury: 42, wellness: 48, spontaneity: 70,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EXPLAINABLE MATCHING ──────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="container-page">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="rounded-card border border-ink-200 bg-white p-6 shadow-card sm:p-8">
                <div className="flex items-start gap-5">
                  <MatchScoreRing score={94} size={84} />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold leading-snug">
                      Costa Rica: Rainforest, Volcanoes & Pacific Coast
                    </h3>
                    <p className="mt-1 text-sm text-ink-500">
                      7 nights · Departs Toronto · {formatMoneyCompact(268900)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-moss-700">
                      Why you’ll probably love this
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                      {['Excellent hiking', 'Strong outdoor focus', 'Small social group', 'Within your $2,500 budget', 'Departs from Toronto', 'Strong food experiences'].map((r) => (
                        <li key={r} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-moss-500" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">
                      Potential mismatch
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                      {['Limited nightlife', 'Faster-paced itinerary'].map((r) => (
                        <li key={r} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-ink-500 text-pretty">
                Illustrative example. Every real score on {brand.name} is produced this way — the
                number and its reasons come from the same calculation.
              </p>
            </div>

            <div className="order-1 lg:order-2">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-terracotta-500">
                Explainable matching
              </p>
              <h2 className="mt-4 text-display-md text-balance sm:text-display-lg">
                A percentage means nothing on its own
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-600 text-pretty">
                So we always show our work. Every match tells you exactly which parts of your
                profile it fits, and where it does not. And because we keep{' '}
                <strong className="font-semibold text-ink-900">how well a trip suits you</strong>{' '}
                separate from{' '}
                <strong className="font-semibold text-ink-900">whether it is good value</strong>,
                a discount can never masquerade as a good match.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRAVELLER MATCHING ────────────────────────────────────────── */}
      <section id="matching" className="scroll-mt-20 border-y border-ink-200 bg-ink-900 py-20 text-white sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-terracotta-300">
              Traveller matching
            </p>
            <h2 className="mt-4 text-display-md text-white text-balance sm:text-display-lg">
              Find people you’d actually want to travel with
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/75 text-pretty">
              The same engine that matches you to trips matches you to people — on travel
              characteristics only, never on anything about who you are.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {[
              {
                title: 'Compatible travellers',
                body: 'See who shares your pace, budget, trip length and interests — and, honestly, where you differ.',
              },
              {
                title: 'Circles',
                body: 'Group your people into a Hiking Crew or a Food & Wine list, and share trips with the right ones.',
              },
              {
                title: 'Group trips that work',
                body: 'When four people love hiking and one does not, we say so. We never hide a disagreement inside an average.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-card border border-white/15 bg-white/[0.06] p-6 backdrop-blur">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70 text-pretty">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-2xl rounded-card border border-white/15 bg-white/[0.06] p-6 text-center">
            <p className="text-sm text-white/75 text-pretty">
              <strong className="font-semibold text-white">Safety is built in, not bolted on.</strong>{' '}
              18+ only, blocking and reporting throughout, a moderation queue behind it, private
              profiles by default, and upcoming travel never public unless you choose.
            </p>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-terracotta-500">
              Membership
            </p>
            <h2 className="mt-4 text-display-md text-balance sm:text-display-lg">
              One price. Everything included.
            </h2>
          </div>

          <div className="mx-auto mt-12 max-w-lg rounded-card border border-ink-200 bg-white p-8 shadow-card sm:p-10">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                {formatMoneyCompact(membership.priceCents)}
              </span>
              <span className="text-ink-500">
                / {membership.interval} {membership.currency}
              </span>
            </div>
            <p className="mt-3 text-ink-600 text-pretty">
              Take the quiz and see your travel personality for free. Join when you want the full
              marketplace.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Unlimited personalised trip recommendations',
                'Full match explanations on every trip',
                `Deals from every provider we work with${cheapest?.salePriceCents ? `, from ${formatMoneyCompact(cheapest.salePriceCents)}` : ''}`,
                'Traveller matching, connections and circles',
                'Group trips, voting and chat',
                'Save, share and track trips',
                'Cancel any time',
              ].map((feature) => (
                <li key={feature} className="flex gap-3 text-[0.95rem] text-ink-700">
                  <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-moss-500" fill="currentColor" aria-hidden="true">
                    <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0Z" />
                  </svg>
                  <span className="text-pretty">{feature}</span>
                </li>
              ))}
            </ul>
            <LinkButton href="/signup" size="lg" fullWidth className="mt-8">
              Start with the free quiz
            </LinkButton>
            <p className="mt-4 text-center text-xs text-ink-500 text-pretty">
              {brand.name} does not sell travel. You book with the provider, on their site, at
              their price.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="border-t border-ink-200 bg-white py-20 sm:py-28">
        <div className="container-prose">
          <h2 className="text-display-md text-center text-balance">Questions</h2>
          <dl className="mt-10 divide-y divide-ink-200">
            {[
              {
                q: `Does ${brand.name} book my trip?`,
                a: 'No. We help you find the right trip and the right people. When you are ready, we send you to the travel provider, who handles the booking, the price and the terms.',
              },
              {
                q: 'Where do the deals come from?',
                a: 'From travel providers — tour operators, vacation package companies, airlines, cruise lines and agencies. We normalise their very different listings into one consistent format so you can actually compare them.',
              },
              {
                q: 'How current are the prices?',
                a: 'Every trip shows when we last checked it. Travel inventory moves quickly, so we tell you how fresh our information is rather than pretending it is live. Final pricing always comes from the provider.',
              },
              {
                q: 'Is the travel personality a psychological test?',
                a: 'No. It describes how you like to travel and nothing else. We never infer anything about who you are, and we never use anything about you beyond your stated travel preferences.',
              },
              {
                q: 'Do I have to use the social side?',
                a: 'Not at all. The trip recommendations work perfectly on their own, with no connections. The social features are there when you want them.',
              },
              {
                q: 'Can I cancel?',
                a: 'Yes, any time, from your settings. Your membership runs to the end of the period you have paid for.',
              },
            ].map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-semibold text-ink-900">{item.q}</dt>
                <dd className="mt-2 text-[0.95rem] leading-relaxed text-ink-600 text-pretty">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-center text-sm text-ink-600">
            More in the{' '}
            <Link href="/faq" className="font-medium text-terracotta-600 underline underline-offset-4">
              full FAQ
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-terracotta-500 py-20 text-white sm:py-24">
        <div className="container-page text-center">
          <h2 className="mx-auto max-w-2xl text-display-md text-white text-balance sm:text-display-lg">
            {brand.tagline}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/85 text-pretty">
            The quiz takes about six minutes and costs nothing.
          </p>
          <LinkButton
            href="/signup"
            size="lg"
            className="mt-8 bg-white text-terracotta-600 hover:bg-sand-100 active:bg-sand-200"
          >
            Find your travel personality
          </LinkButton>
        </div>
      </section>
    </>
  )
}
