import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import {
  ONBOARDING_STEPS, STEP_CATEGORY, nextStep, previousStep, progressFor, STEP_KEYS,
} from '@/lib/onboarding/steps'
import { PreferenceCards } from '@/components/onboarding/PreferenceCards'
import { SpectrumSliders } from '@/components/onboarding/SpectrumSliders'
import { ScenarioQuiz } from '@/components/onboarding/ScenarioQuiz'
import { AirportPicker } from '@/components/onboarding/AirportPicker'
import { BudgetStep } from '@/components/onboarding/BudgetStep'
import { WishlistStep } from '@/components/onboarding/WishlistStep'
import { PhotoStep } from '@/components/onboarding/PhotoStep'
import { PersonalityReveal, type PersonalityView } from '@/components/onboarding/PersonalityReveal'
import { LinkButton } from '@/components/ui'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>
}): Promise<Metadata> {
  const { step } = await params
  const meta = ONBOARDING_STEPS.find((s) => s.key === step)
  return { title: meta?.title ?? 'Set up your profile', robots: { index: false } }
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>
}) {
  const { step } = await params
  if (!STEP_KEYS.includes(step)) notFound()

  const user = await requireUser()
  const meta = ONBOARDING_STEPS.find((s) => s.key === step)!
  const progress = progressFor(step)
  const back = previousStep(step)
  const forward = nextStep(step)
  const backHref = back ? `/onboarding/${back}` : null
  const nextHref = forward ? `/onboarding/${forward}` : '/discover'

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      {/* Progress */}
      {!meta.chrome && (
        <div className="mb-8">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-ink-700">
              Step {progress.current} of {progress.total}
            </span>
            <span className="text-ink-500">{progress.percent}%</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Onboarding progress"
          >
            <div
              className="h-full rounded-full bg-terracotta-500 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {step !== 'personality' && (
        <header className="mb-7">
          <h1 className="text-display-md text-balance">{meta.title}</h1>
          <p className="mt-2 text-ink-600 text-pretty">{meta.subtitle}</p>
        </header>
      )}

      <StepBody step={step} userId={user.id} nextHref={nextHref} backHref={backHref} />
    </div>
  )
}

async function StepBody({
  step, userId, nextHref, backHref,
}: {
  step: string
  userId: string
  nextHref: string
  backHref: string | null
}) {
  // ── Welcome ──────────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div>
        <h1 className="text-display-lg text-balance">Let’s work out how you travel</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-600 text-pretty">
          Six quick scenario questions, then a run through what matters to you — activities, food,
          culture, who you travel with and how much comfort you want. About six minutes.
        </p>
        <ul className="mt-8 space-y-4">
          {[
            ['Nothing is locked in', 'Change any answer later from your profile.'],
            ['Skip anything', 'A blank answer just counts as neutral.'],
            ['Free', 'The quiz and your travel personality cost nothing.'],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3">
              <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-moss-500" fill="currentColor" aria-hidden="true">
                <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0Z" />
              </svg>
              <span className="text-[0.95rem] text-ink-700 text-pretty">
                <strong className="font-semibold text-ink-900">{title}.</strong> {body}
              </span>
            </li>
          ))}
        </ul>
        <LinkButton href={nextHref} size="lg" className="mt-9">
          Start the quiz
        </LinkButton>
      </div>
    )
  }

  // ── Scenarios ────────────────────────────────────────────────────────────
  if (step === 'scenarios') {
    const questions = await prisma.scenarioQuestion.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    })
    return (
      <ScenarioQuiz
        nextHref={nextHref}
        backHref={backHref}
        questions={questions.map((q) => ({
          key: q.key,
          prompt: q.prompt,
          helpText: q.helpText,
          options: q.options.map((o) => ({
            key: o.key, label: o.label, sublabel: o.sublabel, imageUrl: o.imageUrl,
          })),
        }))}
      />
    )
  }

  // ── Preference categories ────────────────────────────────────────────────
  const category = STEP_CATEGORY[step]
  if (category && category !== 'SPECTRUM') {
    const [dimensions, answers] = await Promise.all([
      prisma.preferenceDimension.findMany({
        where: { category: category as 'TRAVEL_STYLE', active: true, kind: 'RATING' },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.userPreference.findMany({ where: { userId }, select: { dimensionId: true, rating: true } }),
    ])
    const byId = new Map(answers.map((a) => [a.dimensionId, a.rating]))
    return (
      <PreferenceCards
        step={step}
        nextHref={nextHref}
        backHref={backHref}
        dimensions={dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          description: d.description,
          rating: byId.get(d.id) ?? null,
        }))}
      />
    )
  }

  if (step === 'spectrums') {
    const [dimensions, answers] = await Promise.all([
      prisma.preferenceDimension.findMany({
        where: { kind: 'SPECTRUM', active: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.userPreference.findMany({ where: { userId }, select: { dimensionId: true, spectrum: true } }),
    ])
    const byId = new Map(answers.map((a) => [a.dimensionId, a.spectrum]))
    return (
      <SpectrumSliders
        step={step}
        nextHref={nextHref}
        backHref={backHref}
        spectrums={dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          lowLabel: d.poleLowLabel ?? 'Less',
          highLabel: d.poleHighLabel ?? 'More',
          value: byId.get(d.id) ?? null,
        }))}
      />
    )
  }

  // ── Airports ─────────────────────────────────────────────────────────────
  if (step === 'airports') {
    const [airports, selected, constraints] = await Promise.all([
      prisma.airport.findMany({
        where: { isActive: true, country: 'CA' },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.userAirport.findMany({
        where: { userId, isTemporary: false },
        orderBy: { rank: 'asc' },
        include: { airport: { select: { iata: true } } },
      }),
      prisma.travelConstraint.findUnique({ where: { userId } }),
    ])
    const toOption = (a: (typeof airports)[number]) => ({
      iata: a.iata, name: a.name, city: a.city, region: a.region, isGateway: a.isGateway,
    })
    return (
      <AirportPicker
        nextHref={nextHref}
        backHref={backHref}
        gateways={airports.filter((a) => a.isGateway).map(toOption)}
        secondary={airports.filter((a) => !a.isGateway).map(toOption)}
        selected={selected.map((s) => s.airport.iata)}
        airportsAreHard={constraints?.airportsAreHard ?? false}
        includeNearby={constraints?.includeNearbyAirports ?? true}
      />
    )
  }

  // ── Budget & dates ───────────────────────────────────────────────────────
  if (step === 'budget') {
    const constraints = await prisma.travelConstraint.findUnique({ where: { userId } })
    return (
      <BudgetStep
        nextHref={nextHref}
        backHref={backHref}
        initial={{
          budgetPreferred: constraints?.budgetPreferred ?? null,
          budgetMax: constraints?.budgetMax ?? null,
          budgetMaxIsHard: constraints?.budgetMaxIsHard ?? true,
          durationMin: constraints?.durationMin ?? null,
          durationMax: constraints?.durationMax ?? null,
          durationPreferred: constraints?.durationPreferred ?? null,
          durationIsHard: constraints?.durationIsHard ?? false,
          preferredMonths: constraints?.preferredMonths ?? [],
          partySize: constraints?.partySize ?? 1,
          dateFlexibilityDays: constraints?.dateFlexibilityDays ?? 7,
        }}
      />
    )
  }

  // ── Wishlist ─────────────────────────────────────────────────────────────
  if (step === 'wishlist') {
    const [destinations, existing] = await Promise.all([
      prisma.destination.findMany({
        where: { kind: 'COUNTRY', active: true },
        orderBy: { name: 'asc' },
        select: { slug: true, name: true },
      }),
      prisma.wishlistItem.findMany({ where: { userId }, select: { id: true, label: true } }),
    ])
    return (
      <WishlistStep
        nextHref={nextHref}
        backHref={backHref}
        existing={existing}
        suggestions={destinations.map((d) => ({ slug: d.slug, name: d.name, kind: 'COUNTRY' as const }))}
      />
    )
  }

  // ── Photo ────────────────────────────────────────────────────────────────
  if (step === 'photo') {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { photoUrl: true, firstName: true },
    })
    return (
      <PhotoStep
        nextHref={nextHref}
        backHref={backHref}
        initialUrl={profile?.photoUrl ?? null}
        firstName={profile?.firstName ?? 'You'}
      />
    )
  }

  // ── Personality reveal ───────────────────────────────────────────────────
  if (step === 'personality') {
    const [personality, profile] = await Promise.all([
      prisma.travelPersonality.findUnique({ where: { userId } }),
      prisma.profile.findUnique({ where: { userId }, select: { firstName: true } }),
    ])
    const view: PersonalityView | null = personality
      ? {
          title: personality.title,
          description: personality.description,
          topInterests: personality.topInterests,
          tripStyles: personality.tripStyles,
          destinationIdeas: personality.destinationIdeas,
          idealCompanions: personality.idealCompanions,
          radar: (personality.radar ?? {}) as Record<string, number>,
          generatedBy: personality.generatedBy,
        }
      : null
    return <PersonalityReveal initial={view} firstName={profile?.firstName ?? 'You'} />
  }

  redirect('/onboarding/welcome')
}
