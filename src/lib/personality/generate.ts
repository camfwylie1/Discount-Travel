import 'server-only'
import { prisma } from '@/lib/db'
import { ai } from '@/lib/ai'
import { computeRadar, describeBudgetBand, describeTripLengthBand } from './radar'
import { logger } from '@/lib/observability/logger'

/**
 * Builds the traveller's Travel DNA and generates their personality profile.
 *
 * The radar is always computed deterministically from the preference answers.
 * Only the prose is generated, and it falls back to template copy when no AI
 * provider is configured — so this never fails and never blocks onboarding.
 */
export async function generatePersonality(userId: string, options: { force?: boolean } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      constraints: true,
      preferences: { include: { dimension: true } },
      personality: true,
    },
  })
  if (!user) throw new Error('User not found.')

  // A member who has edited their profile by hand keeps it unless they
  // explicitly ask for a regeneration.
  if (user.personality?.isEdited && !options.force) return user.personality

  const radarInputs = user.preferences.map((p) => ({
    dimensionKey: p.dimension.key,
    radarAxis: p.dimension.radarAxis,
    kind: p.dimension.kind as 'RATING' | 'SPECTRUM',
    engineWeight: p.dimension.engineWeight,
    rating: p.rating,
    spectrum: p.spectrum,
  }))
  const radar = computeRadar(radarInputs)

  const rated = user.preferences.filter((p) => p.dimension.kind === 'RATING' && p.rating != null)
  const topLikes = rated
    .filter((p) => (p.rating ?? 3) >= 4)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.dimension.engineWeight - a.dimension.engineWeight)
    .slice(0, 8)
    .map((p) => ({ key: p.dimension.key, label: p.dimension.label, rating: p.rating! }))
  const topDislikes = rated
    .filter((p) => (p.rating ?? 3) <= 2)
    .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0) || b.dimension.engineWeight - a.dimension.engineWeight)
    .slice(0, 5)
    .map((p) => ({ key: p.dimension.key, label: p.dimension.label, rating: p.rating! }))

  const spectrums = user.preferences
    .filter((p) => p.dimension.kind === 'SPECTRUM' && p.spectrum != null)
    .map((p) => ({
      key: p.dimension.key,
      label: p.dimension.label,
      lowLabel: p.dimension.poleLowLabel ?? '',
      highLabel: p.dimension.poleHighLabel ?? '',
      value: p.spectrum!,
    }))

  const result = await ai.generateTravelerPersonality(
    {
      firstName: user.profile?.firstName ?? 'there',
      topLikes,
      topDislikes,
      spectrums,
      radar,
      budgetBand: describeBudgetBand(user.constraints?.budgetPreferred),
      tripLengthBand: describeTripLengthBand(user.constraints?.durationMin, user.constraints?.durationMax),
      homeCity: user.profile?.homeCity ?? null,
    },
    { force: options.force },
  )

  const data = result.data
  logger.info('personality.generated', {
    userId,
    provider: result.provider,
    usedFallback: result.usedFallback,
    cached: result.cached,
  })

  return prisma.travelPersonality.upsert({
    where: { userId },
    create: {
      userId,
      title: data.title,
      description: data.description,
      topInterests: data.topInterests ?? [],
      tripStyles: data.tripStyles ?? [],
      destinationIdeas: data.destinationIdeas ?? [],
      idealCompanions: data.idealCompanions ?? null,
      radar,
      archetypeKey: data.archetypeKey ?? null,
      generatedBy: result.provider,
      model: result.model,
      isEdited: false,
    },
    update: {
      title: data.title,
      description: data.description,
      topInterests: data.topInterests ?? [],
      tripStyles: data.tripStyles ?? [],
      destinationIdeas: data.destinationIdeas ?? [],
      idealCompanions: data.idealCompanions ?? null,
      radar,
      archetypeKey: data.archetypeKey ?? null,
      generatedBy: result.provider,
      model: result.model,
      isEdited: false,
      version: { increment: 1 },
    },
  })
}
