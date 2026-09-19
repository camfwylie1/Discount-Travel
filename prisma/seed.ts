/**
 * SEED
 *
 * Populates a fresh database with:
 *   • the preference taxonomy and scenario questions
 *   • Canadian gateway airports and a destination tree
 *   • fictional providers, complete with compliance records
 *   • realistic demonstration inventory, clearly flagged as demo content
 *   • fictional traveller personas with connections, circles, trips and chat
 *   • an administrator account and a prepared investor demo account
 *
 * Run with:  npm run seed
 * Reset all: npm run db:reset   (drops, migrates, then seeds)
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from '@node-rs/argon2'
import { PrismaClient } from '../src/generated/prisma/client'
import { DIMENSION_SEEDS } from '../src/lib/taxonomy/dimensions'
import { SCENARIO_SEEDS } from '../src/lib/taxonomy/scenarios'
import { AIRPORT_SEEDS } from '../src/lib/taxonomy/airports'
import { DESTINATION_SEEDS, TRAIT_TO_DIMENSIONS } from '../src/lib/taxonomy/destinations'
import { PROVIDER_SEEDS } from '../src/lib/taxonomy/providers'
import { DEAL_TEMPLATES, type DealTemplate } from '../src/lib/taxonomy/deals'
import { PERSONA_SEEDS, type PersonaSeed } from './seed-personas'
import { computeRadar } from '../src/lib/personality/radar'
import { computeDealValue } from '../src/lib/recommendations/dealValue'
import { FallbackAiProvider } from '../src/lib/ai/providers/fallback'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set.')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
const fallbackAi = new FallbackAiProvider()

const ARGON2 = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 } as const
const DAY = 86_400_000
const SEED_DEMO = (process.env.SEED_DEMO_DATA ?? 'true') !== 'false'

/** Deterministic pseudo-random so every seed run produces the same demo data. */
let rngState = 1337
function rnd(): number {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff
  return rngState / 0x7fffffff
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!
const rndInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))

function log(step: string, detail?: string | number) {
  console.log(`  ${step}${detail !== undefined ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('\n🌍  Seeding Voyaj\n')

  // ── 1. TAXONOMY ───────────────────────────────────────────────────────────
  for (const [index, dim] of DIMENSION_SEEDS.entries()) {
    await prisma.preferenceDimension.upsert({
      where: { key: dim.key },
      create: {
        key: dim.key,
        label: dim.label,
        description: dim.description ?? null,
        category: dim.category,
        kind: dim.kind ?? 'RATING',
        poleLowLabel: dim.poleLowLabel ?? null,
        poleHighLabel: dim.poleHighLabel ?? null,
        engineWeight: dim.engineWeight ?? 1,
        isCore: dim.isCore ?? false,
        radarAxis: dim.radarAxis ?? null,
        sortOrder: index,
      },
      update: {
        label: dim.label,
        category: dim.category,
        kind: dim.kind ?? 'RATING',
        poleLowLabel: dim.poleLowLabel ?? null,
        poleHighLabel: dim.poleHighLabel ?? null,
        engineWeight: dim.engineWeight ?? 1,
        isCore: dim.isCore ?? false,
        radarAxis: dim.radarAxis ?? null,
        sortOrder: index,
      },
    })
  }
  const dimensions = await prisma.preferenceDimension.findMany()
  const dimByKey = new Map(dimensions.map((d) => [d.key, d]))
  log('Preference dimensions', dimensions.length)

  // ── 2. SCENARIO QUESTIONS ────────────────────────────────────────────────
  for (const [qIndex, scenario] of SCENARIO_SEEDS.entries()) {
    const question = await prisma.scenarioQuestion.upsert({
      where: { key: scenario.key },
      create: { key: scenario.key, prompt: scenario.prompt, helpText: scenario.helpText ?? null, sortOrder: qIndex },
      update: { prompt: scenario.prompt, helpText: scenario.helpText ?? null, sortOrder: qIndex },
    })
    for (const [oIndex, option] of scenario.options.entries()) {
      const opt = await prisma.scenarioOption.upsert({
        where: { questionId_key: { questionId: question.id, key: option.key } },
        create: {
          questionId: question.id, key: option.key, label: option.label,
          sublabel: option.sublabel ?? null, imageUrl: option.imageUrl ?? null, sortOrder: oIndex,
        },
        update: { label: option.label, sublabel: option.sublabel ?? null, imageUrl: option.imageUrl ?? null, sortOrder: oIndex },
      })
      for (const [dimKey, delta] of Object.entries(option.effects)) {
        const dim = dimByKey.get(dimKey)
        if (!dim) {
          console.warn(`    ⚠ scenario "${scenario.key}/${option.key}" references unknown dimension "${dimKey}"`)
          continue
        }
        await prisma.scenarioEffect.upsert({
          where: { optionId_dimensionId: { optionId: opt.id, dimensionId: dim.id } },
          create: { optionId: opt.id, dimensionId: dim.id, delta },
          update: { delta },
        })
      }
    }
  }
  log('Scenario questions', SCENARIO_SEEDS.length)

  // ── 3. AIRPORTS ──────────────────────────────────────────────────────────
  for (const a of AIRPORT_SEEDS) {
    await prisma.airport.upsert({
      where: { iata: a.iata },
      create: {
        iata: a.iata, icao: a.icao ?? null, name: a.name, city: a.city,
        region: a.region ?? null, country: a.country, continent: a.continent,
        timezone: a.timezone ?? null, latitude: a.latitude, longitude: a.longitude,
        isGateway: a.isGateway ?? false, sortOrder: a.sortOrder ?? 999,
      },
      update: {
        name: a.name, city: a.city, region: a.region ?? null, country: a.country,
        continent: a.continent, latitude: a.latitude, longitude: a.longitude,
        isGateway: a.isGateway ?? false, sortOrder: a.sortOrder ?? 999,
      },
    })
  }
  const airports = await prisma.airport.findMany()
  const airportByIata = new Map(airports.map((a) => [a.iata, a]))
  log('Airports', airports.length)

  // ── 4. DESTINATIONS (two passes so parents exist first) ──────────────────
  for (const d of DESTINATION_SEEDS) {
    await prisma.destination.upsert({
      where: { slug: d.slug },
      create: {
        slug: d.slug, name: d.name, kind: d.kind, country: d.country ?? null,
        countryName: d.countryName ?? null, continent: d.continent ?? null,
        latitude: d.latitude ?? null, longitude: d.longitude ?? null,
        heroImageUrl: d.heroImageUrl ?? null, blurb: d.blurb ?? null, traits: d.traits ?? [],
      },
      update: {
        name: d.name, kind: d.kind, country: d.country ?? null,
        countryName: d.countryName ?? null, continent: d.continent ?? null,
        heroImageUrl: d.heroImageUrl ?? null, blurb: d.blurb ?? null, traits: d.traits ?? [],
      },
    })
  }
  for (const d of DESTINATION_SEEDS) {
    if (!d.parent) continue
    const parent = await prisma.destination.findUnique({ where: { slug: d.parent } })
    if (parent) await prisma.destination.update({ where: { slug: d.slug }, data: { parentId: parent.id } })
  }
  const destinations = await prisma.destination.findMany()
  const destBySlug = new Map(destinations.map((d) => [d.slug, d]))
  log('Destinations', destinations.length)

  // ── 5. TAGS ──────────────────────────────────────────────────────────────
  const TAGS = [
    ['hiking', 'Hiking', 'ACTIVITY'], ['food-wine', 'Food & wine', 'THEME'],
    ['beach', 'Beach', 'THEME'], ['ski', 'Ski', 'ACTIVITY'], ['safari', 'Safari', 'THEME'],
    ['city-break', 'City break', 'THEME'], ['all-inclusive', 'All-inclusive', 'THEME'],
    ['solo-friendly', 'Solo friendly', 'AUDIENCE'], ['small-group', 'Small group', 'AUDIENCE'],
    ['wellness', 'Wellness', 'THEME'], ['cruise', 'Cruise', 'THEME'],
    ['road-trip', 'Road trip', 'THEME'], ['adventure', 'Adventure', 'THEME'],
    ['culture', 'Culture', 'THEME'], ['last-minute', 'Last minute', 'TIMING'],
    ['weekend', 'Weekend', 'TIMING'], ['domestic', 'Within Canada', 'GEO'],
  ] as const
  for (const [slug, label, kind] of TAGS) {
    await prisma.tag.upsert({ where: { slug }, create: { slug, label, kind }, update: { label, kind } })
  }
  const tags = await prisma.tag.findMany()
  const tagBySlug = new Map(tags.map((t) => [t.slug, t]))
  log('Tags', tags.length)

  // ── 6. PROVIDERS ─────────────────────────────────────────────────────────
  for (const p of PROVIDER_SEEDS) {
    const provider = await prisma.provider.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug, name: p.name, websiteUrl: p.websiteUrl, description: p.description,
        tripTypes: [...p.tripTypes], qualityScore: p.qualityScore,
        active: p.compliance.status !== 'BLOCKED',
      },
      update: {
        name: p.name, websiteUrl: p.websiteUrl, description: p.description,
        tripTypes: [...p.tripTypes], qualityScore: p.qualityScore,
        active: p.compliance.status !== 'BLOCKED',
      },
    })
    const c = p.compliance
    await prisma.providerCompliance.upsert({
      where: { providerId: provider.id },
      create: {
        providerId: provider.id, status: c.status, hasPublicApi: c.hasPublicApi,
        hasAffiliateProgram: c.hasAffiliateProgram, affiliateNetwork: c.affiliateNetwork ?? null,
        commissionModel: c.commissionModel ?? null,
        structuredExtractionPermitted: c.structuredExtractionPermitted,
        attributionRequired: c.attributionRequired, attributionText: c.attributionText ?? null,
        imageUseRestricted: c.imageUseRestricted, maxCacheHours: c.maxCacheHours ?? null,
        allowedMethods: [...c.allowedMethods], updateFrequencyHours: c.updateFrequencyHours ?? null,
        notes: c.notes ?? null, blockedReason: c.blockedReason ?? null,
        termsReviewedAt: c.status === 'NOT_REVIEWED' ? null : new Date(),
      },
      update: {
        status: c.status, allowedMethods: [...c.allowedMethods],
        blockedReason: c.blockedReason ?? null, notes: c.notes ?? null,
      },
    })
  }
  const providers = await prisma.provider.findMany({ include: { compliance: true } })
  const providerBySlug = new Map(providers.map((p) => [p.slug, p]))
  log('Providers', providers.length)

  if (!SEED_DEMO) {
    console.log('\nSEED_DEMO_DATA=false — skipping demonstration inventory and accounts.\n')
    return
  }

  // ── 7. DEALS ─────────────────────────────────────────────────────────────
  // Each template expands into several dated departures from different
  // gateways, which is how real tour inventory behaves.
  await prisma.deal.deleteMany({ where: { isDemoContent: true } })
  let dealCount = 0
  const createdDeals: { id: string; template: DealTemplate }[] = []
  const now = new Date()

  for (const template of DEAL_TEMPLATES) {
    const provider = providerBySlug.get(template.provider)
    if (!provider) { console.warn(`    ⚠ unknown provider ${template.provider}`); continue }
    // The compliance gate applies to seeding too.
    if (provider.compliance?.status === 'BLOCKED') {
      console.log(`    ⛔ skipped ${template.ref} — provider "${provider.name}" is blocked`)
      continue
    }

    const destination = destBySlug.get(template.destinationSlug)
    const arrivalAirport = template.arrivalIata ? airportByIata.get(template.arrivalIata) : null

    for (const iata of template.departures) {
      const departureAirport = airportByIata.get(iata)
      if (!departureAirport) continue

      // Several departures per gateway, spread across the months the product
      // actually runs, so month-based searches find realistic inventory.
      const departureCount = template.departures.length > 4 ? 2 : 3
      for (let variant = 0; variant < departureCount; variant++) {
        const monthOffset = pickFutureMonth(template.months, now, variant)
        if (!monthOffset) continue
        const departureDate = monthOffset
        const returnDate = new Date(departureDate.getTime() + template.nights * DAY)

        const premium = template.gatewayPremium?.[iata] ?? 0
        const jitter = Math.round((rnd() - 0.5) * template.basePriceCents * 0.06)
        const salePrice = Math.max(29_900, template.basePriceCents + premium + jitter)
        const regularPrice = template.regularPriceCents
          ? template.regularPriceCents + premium + jitter
          : null

        const slug = `${slugify(template.title)}-${iata.toLowerCase()}-${departureDate.toISOString().slice(0, 7)}-${variant}`
        const isFlash = provider.slug === 'atlas-flash'
        const expiresAt = isFlash
          ? new Date(Date.now() + rndInt(2, 9) * DAY)
          : new Date(departureDate.getTime() - 21 * DAY)

        // Confidence: what we actually know vs what we are inferring.
        const confidence = {
          destination: 1,
          price: 1,
          dates: 1,
          airfareIncluded: template.airfareIncluded === null ? 0 : 1,
          inclusions: template.incomplete ? 0.3 : 0.95,
          groupSize: template.groupSizeMax ? 0.9 : 0,
          accommodation: template.accommodationType ? 0.9 : 0,
          attributes: template.incomplete ? 0.5 : 0.85,
        }
        const overallConfidence =
          Object.values(confidence).reduce((s, v) => s + v, 0) / Object.keys(confidence).length

        const qualityIssues: string[] = []
        if (template.incomplete) qualityIssues.push('Provider did not specify inclusions')
        if (!template.accommodationType) qualityIssues.push('Accommodation type not specified')
        if (template.accommodationQuality === null) qualityIssues.push('Accommodation standard not specified')

        const value = computeDealValue({
          salePriceCents: salePrice,
          regularPriceCents: regularPrice,
          // We have not independently observed the "regular" price for demo data.
          observedHigherPriceCount: 0,
          durationNights: template.nights,
          airfareIncluded: template.airfareIncluded,
          accommodationIncluded: template.accommodationIncluded,
          mealsIncluded: template.mealsIncluded,
          activitiesIncluded: template.activitiesIncluded,
          guideIncluded: template.guideIncluded,
          transportIncluded: template.transportIncluded,
          accommodationQuality: template.accommodationQuality,
          providerQuality: provider.qualityScore,
        })

        // AI summary via the deterministic provider, so seeding costs nothing
        // and is reproducible. Real AI runs at ingestion when a key is set.
        const summary = await fallbackAi.summariseDeal({
          title: template.title,
          description: template.description,
          destination: [template.city, template.region, destination?.countryName ?? template.country]
            .filter(Boolean).join(', '),
          departureAirport: departureAirport.iata,
          durationNights: template.nights,
          facts: {
            airfareIncluded: template.airfareIncluded,
            accommodationIncluded: template.accommodationIncluded,
            mealsIncluded: template.mealsIncluded,
            activitiesIncluded: template.activitiesIncluded,
            guideIncluded: template.guideIncluded,
            accommodationType: template.accommodationType,
            groupSizeMax: template.groupSizeMax ?? null,
            physicalDifficulty: template.physicalDifficulty,
            tripStyle: template.tripStyle,
          },
          inclusions: template.inclusions,
          highlightCandidates: deriveHighlights(template),
        })

        const deal = await prisma.deal.create({
          data: {
            slug,
            providerId: provider.id,
            sourceUrl: `${provider.websiteUrl}/trips/${template.ref.toLowerCase()}`,
            affiliateUrl: provider.compliance?.hasAffiliateProgram
              ? `${provider.websiteUrl}/trips/${template.ref.toLowerCase()}?ref=voyaj`
              : null,
            sourceReference: `${template.ref}-${iata}-${variant}`,
            sourceAttribution: provider.compliance?.attributionText ?? `Operated by ${provider.name}`,
            ingestionMethod: 'MANUAL_ENTRY',
            originalTitle: template.title,
            normalizedTitle: template.title,
            originalDescription: template.description,
            aiSummary: summary.summary,
            aiSummaryModel: 'fallback',
            aiSummaryAt: new Date(),
            highlights: summary.highlights,
            destinationCountry: template.country,
            destinationRegion: template.region ?? null,
            destinationCity: template.city ?? null,
            continent: template.continent,
            latitude: destination?.latitude ?? null,
            longitude: destination?.longitude ?? null,
            departureAirportId: departureAirport.id,
            arrivalAirportId: arrivalAirport?.id ?? null,
            departureDate,
            returnDate,
            dateFlexibility: template.departures.length > 2 ? 'MULTIPLE_DEPARTURES' : 'FIXED',
            durationNights: template.nights,
            durationDays: template.nights + 1,
            currency: 'CAD',
            salePriceCents: salePrice,
            regularPriceCents: regularPrice,
            discountCents: regularPrice ? regularPrice - salePrice : null,
            discountPercent: regularPrice ? ((regularPrice - salePrice) / regularPrice) * 100 : null,
            pricePerPerson: true,
            taxesIncluded: template.incomplete ? null : true,
            feesIncluded: template.incomplete ? null : true,
            airfareIncluded: template.airfareIncluded,
            accommodationIncluded: template.accommodationIncluded,
            mealsIncluded: template.mealsIncluded,
            mealsDescription: template.mealsDescription ?? null,
            activitiesIncluded: template.activitiesIncluded,
            transportIncluded: template.transportIncluded,
            guideIncluded: template.guideIncluded,
            accommodationType: template.accommodationType,
            accommodationQuality: template.accommodationQuality,
            groupSizeMin: template.groupSizeMin ?? null,
            groupSizeMax: template.groupSizeMax ?? null,
            minAge: template.minAge ?? null,
            physicalDifficulty: template.physicalDifficulty,
            activityLevel: template.activityLevel ?? null,
            tripStyle: template.tripStyle,
            soloFriendly: template.soloFriendly ?? null,
            cancellationPolicy: template.cancellationPolicy ?? null,
            status: 'ACTIVE',
            bookingDeadline: new Date(departureDate.getTime() - 14 * DAY),
            spotsRemaining: template.groupSizeMax ? rndInt(2, template.groupSizeMax) : null,
            sourceLastCheckedAt: new Date(Date.now() - rndInt(1, 40) * 3_600_000),
            verifiedAt: new Date(Date.now() - rndInt(1, 72) * 3_600_000),
            expiresAt,
            confidence,
            overallConfidence,
            qualityIssues,
            valueScore: value.score,
            valueComponents: value as object,
            valueComputedAt: new Date(),
            isDemoContent: true,
            providerMetadata: { seedTemplate: template.ref, gateway: iata },
          },
        })
        dealCount++
        createdDeals.push({ id: deal.id, template })

        // Images
        await prisma.dealImage.createMany({
          data: template.images.map((url, i) => ({
            dealId: deal.id, url, alt: `${template.title} — image ${i + 1}`,
            sortOrder: i, isHero: i === 0,
          })),
        })

        // Attributes: SOURCE-grade facts from the curated template, plus
        // destination-trait rules at a lower confidence.
        const attrMap = new Map<string, { intensity: number; confidence: number; source: string; evidence: string }>()
        for (const [key, intensity] of Object.entries(template.attributes)) {
          const dim = dimByKey.get(key)
          if (!dim) { console.warn(`    ⚠ deal ${template.ref} references unknown dimension "${key}"`); continue }
          attrMap.set(dim.id, {
            intensity,
            confidence: template.incomplete ? 0.55 : 0.9,
            source: 'SOURCE',
            evidence: 'Stated in the provider listing',
          })
        }
        for (const trait of destination?.traits ?? []) {
          for (const mapping of TRAIT_TO_DIMENSIONS[trait] ?? []) {
            const dim = dimByKey.get(mapping.key)
            if (!dim || attrMap.has(dim.id)) continue
            attrMap.set(dim.id, {
              intensity: mapping.intensity,
              confidence: 0.45,
              source: 'RULE',
              evidence: `Inferred from destination trait "${trait}"`,
            })
          }
        }
        await prisma.dealAttribute.createMany({
          data: [...attrMap.entries()].map(([dimensionId, a]) => ({ dealId: deal.id, dimensionId, ...a })),
        })

        // Inclusions / exclusions
        await prisma.dealInclusion.createMany({
          data: [
            ...template.inclusions.map((label, i) => ({ dealId: deal.id, kind: 'INCLUDED', label, sortOrder: i })),
            ...template.exclusions.map((label, i) => ({ dealId: deal.id, kind: 'EXCLUDED', label, sortOrder: i })),
          ],
        })

        // Itinerary
        if (template.itinerary) {
          await prisma.itineraryDay.createMany({
            data: template.itinerary.map((day, i) => ({
              dealId: deal.id, dayNumber: i + 1, title: day.title,
              description: day.description, location: day.location ?? null,
            })),
          })
        }

        // Destination links
        if (destination) {
          await prisma.dealDestination.create({
            data: { dealId: deal.id, destinationId: destination.id, isPrimary: true },
          })
          if (destination.parentId) {
            await prisma.dealDestination.create({
              data: { dealId: deal.id, destinationId: destination.parentId, isPrimary: false },
            }).catch(() => {})
          }
        }

        // Tags
        const dealTags = deriveTags(template)
        for (const slug of dealTags) {
          const tag = tagBySlug.get(slug)
          if (tag) await prisma.dealTagLink.create({ data: { dealId: deal.id, tagId: tag.id } }).catch(() => {})
        }

        // A little price history, so the value engine has something real to
        // verify against for a subset of deals.
        if (regularPrice && rnd() > 0.55) {
          await prisma.dealPriceHistory.createMany({
            data: [
              { dealId: deal.id, priceCents: regularPrice, observedAt: new Date(Date.now() - 45 * DAY) },
              { dealId: deal.id, priceCents: regularPrice, observedAt: new Date(Date.now() - 20 * DAY) },
              { dealId: deal.id, priceCents: salePrice, observedAt: new Date() },
            ],
          })
        }
      }
    }
  }
  log('Deals', dealCount)

  // Mark a handful as featured, and demonstrate the full status lifecycle.
  const featured = await prisma.deal.findMany({ where: { isDemoContent: true }, take: 6, orderBy: { valueScore: 'desc' } })
  for (const [i, d] of featured.entries()) {
    await prisma.deal.update({ where: { id: d.id }, data: { featured: true, featuredRank: i + 1 } })
  }
  const lifecycle = await prisma.deal.findMany({ where: { isDemoContent: true }, skip: 40, take: 4 })
  const statuses = ['POSSIBLY_EXPIRED', 'SOLD_OUT', 'EXPIRED', 'UNKNOWN'] as const
  for (const [i, d] of lifecycle.entries()) {
    await prisma.deal.update({
      where: { id: d.id },
      data: {
        status: statuses[i % statuses.length],
        sourceLastCheckedAt: new Date(Date.now() - rndInt(50, 200) * 3_600_000),
      },
    })
  }
  log('Deal status lifecycle examples', lifecycle.length)

  // ── 8. USERS ─────────────────────────────────────────────────────────────
  const adminEmail = (process.env.ADMIN_ACCOUNT_EMAIL ?? 'admin@voyaj.test').toLowerCase()
  const adminPassword = process.env.ADMIN_ACCOUNT_PASSWORD ?? 'VoyajAdmin!2025'
  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD ?? 'VoyajDemo!2025'

  const admin = await prisma.user.upsert({
    where: { emailNormalized: adminEmail },
    create: {
      email: adminEmail, emailNormalized: adminEmail,
      passwordHash: await hash(adminPassword, ARGON2),
      role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(),
      ageConfirmed18: true, ageConfirmedAt: new Date(),
      termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(),
      onboardingComplete: true,
      profile: { create: { firstName: 'Voyaj', lastInitial: 'A', homeCity: 'Toronto', homeCountry: 'CA' } },
      privacy: { create: { discoverable: false, profileVisibility: 'PRIVATE' } },
    },
    update: { role: 'ADMIN', status: 'ACTIVE', passwordHash: await hash(adminPassword, ARGON2) },
  })
  log('Administrator', admin.email)

  const personaUsers = new Map<string, string>()
  for (const persona of PERSONA_SEEDS) {
    const userId = await seedPersona(persona, demoPassword, dimByKey, airportByIata, destBySlug)
    personaUsers.set(persona.key, userId)
  }
  log('Demo travellers', personaUsers.size)

  // ── 9. SOCIAL GRAPH ──────────────────────────────────────────────────────
  const cameronId = personaUsers.get('cameron')!
  const CONNECTIONS: [string, string, 'ACCEPTED' | 'PENDING'][] = [
    ['cameron', 'sarah', 'ACCEPTED'], ['cameron', 'priya', 'ACCEPTED'],
    ['cameron', 'marc', 'ACCEPTED'], ['cameron', 'jordan', 'ACCEPTED'],
    ['cameron', 'daniel', 'ACCEPTED'], ['cameron', 'wes', 'ACCEPTED'],
    ['sarah', 'priya', 'ACCEPTED'], ['sarah', 'amelia', 'ACCEPTED'],
    ['marc', 'leah', 'ACCEPTED'], ['priya', 'ify', 'ACCEPTED'],
    ['nina', 'cameron', 'PENDING'], ['tomas', 'cameron', 'PENDING'],
    ['wes', 'amelia', 'ACCEPTED'], ['daniel', 'leah', 'ACCEPTED'],
  ]
  for (const [from, to, status] of CONNECTIONS) {
    const requesterId = personaUsers.get(from)
    const addresseeId = personaUsers.get(to)
    if (!requesterId || !addresseeId) continue
    await prisma.connection.upsert({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
      create: {
        requesterId, addresseeId, status,
        respondedAt: status === 'ACCEPTED' ? new Date(Date.now() - rndInt(3, 90) * DAY) : null,
        message: status === 'PENDING' ? 'Saw we match on hiking — would be good to compare notes.' : null,
      },
      update: { status },
    })
  }
  log('Connections', CONNECTIONS.length)

  // Circles
  const CIRCLES: { owner: string; name: string; description: string; colour: string; members: string[] }[] = [
    { owner: 'cameron', name: 'Hiking Crew', description: 'Anyone who will get up early for a trail.', colour: 'moss', members: ['sarah', 'priya', 'daniel', 'wes'] },
    { owner: 'cameron', name: 'Food & Wine', description: 'Long lunches, good bottles.', colour: 'gold', members: ['marc', 'priya'] },
    { owner: 'cameron', name: 'Weekend Trips', description: 'Short notice, short trips.', colour: 'terracotta', members: ['jordan', 'sarah', 'ify'] },
    { owner: 'sarah', name: 'Trail Runners', description: 'Fast and light.', colour: 'ocean', members: ['cameron', 'amelia'] },
  ]
  for (const c of CIRCLES) {
    const ownerId = personaUsers.get(c.owner)
    if (!ownerId) continue
    const existing = await prisma.circle.findFirst({ where: { ownerId, name: c.name } })
    const circle = existing ?? (await prisma.circle.create({
      data: { ownerId, name: c.name, description: c.description, colour: c.colour },
    }))
    for (const memberKey of c.members) {
      const userId = personaUsers.get(memberKey)
      if (!userId) continue
      await prisma.circleMember.upsert({
        where: { circleId_userId: { circleId: circle.id, userId } },
        create: { circleId: circle.id, userId }, update: {},
      })
    }
    // Every circle gets a conversation.
    const conversation = await prisma.conversation.upsert({
      where: { circleId: circle.id },
      create: { kind: 'CIRCLE', circleId: circle.id, title: circle.name },
      update: {},
    })
    for (const userId of [ownerId, ...c.members.map((m) => personaUsers.get(m)).filter((x): x is string => !!x)]) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId } },
        create: { conversationId: conversation.id, userId }, update: {},
      })
    }
  }
  log('Circles', CIRCLES.length)

  // ── 10. SAVED DEALS, WISHLIST ENGAGEMENT, SHARES ─────────────────────────
  const allDeals = await prisma.deal.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, providerId: true, destinationCountry: true, salePriceCents: true, tripStyle: true },
  })

  const SAVES: Record<string, { country?: string; style?: string; state: 'SAVED' | 'INTERESTED' | 'PLANNING' | 'BOOKED' | 'PAST' }[]> = {
    cameron: [
      { country: 'CR', state: 'PLANNING' }, { country: 'PT', state: 'INTERESTED' },
      { country: 'CL', state: 'SAVED' }, { country: 'JP', state: 'SAVED' },
      { country: 'IT', state: 'SAVED' }, { country: 'CA', state: 'PAST' },
    ],
    sarah: [{ country: 'CL', state: 'INTERESTED' }, { country: 'CR', state: 'SAVED' }, { country: 'PE', state: 'SAVED' }],
    priya: [{ country: 'JP', state: 'PLANNING' }, { country: 'MX', state: 'SAVED' }, { country: 'ES', state: 'SAVED' }],
    marc: [{ country: 'PT', state: 'PLANNING' }, { country: 'ZA', state: 'INTERESTED' }, { country: 'IT', state: 'SAVED' }],
    jordan: [{ country: 'DO', state: 'BOOKED' }, { country: 'MX', state: 'SAVED' }, { country: 'JM', state: 'SAVED' }],
    daniel: [{ country: 'TZ', state: 'PLANNING' }, { country: 'ZA', state: 'SAVED' }],
    amelia: [{ country: 'TH', state: 'INTERESTED' }, { country: 'ID', state: 'SAVED' }],
    nina: [{ country: 'ID', state: 'PLANNING' }, { country: 'TZ', state: 'SAVED' }],
    wes: [{ country: 'JP', state: 'INTERESTED' }, { country: 'FR', state: 'SAVED' }],
    leah: [{ country: 'JP', state: 'PLANNING' }, { country: 'ES', state: 'SAVED' }],
    tomas: [{ country: 'IS', state: 'PLANNING' }, { country: 'CA', state: 'SAVED' }],
    ify: [{ country: 'PT', state: 'INTERESTED' }, { country: 'ES', state: 'SAVED' }, { country: 'IT', state: 'SAVED' }],
  }
  let saveCount = 0
  for (const [personaKey, saves] of Object.entries(SAVES)) {
    const userId = personaUsers.get(personaKey)
    if (!userId) continue
    for (const save of saves) {
      const candidates = allDeals.filter((d) => !save.country || d.destinationCountry === save.country)
      if (candidates.length === 0) continue
      const deal = pick(candidates)
      await prisma.savedDeal.upsert({
        where: { userId_dealId: { userId, dealId: deal.id } },
        create: {
          userId, dealId: deal.id, state: save.state,
          selfReportedBooking: save.state === 'BOOKED',
          createdAt: new Date(Date.now() - rndInt(1, 60) * DAY),
        },
        update: { state: save.state },
      })
      saveCount++
    }
  }
  log('Saved deals', saveCount)

  // ── 11. TRIP GROUP + CHAT ────────────────────────────────────────────────
  const costaRica = allDeals.find((d) => d.destinationCountry === 'CR')
  if (costaRica) {
    // Deleting demo deals on a reseed nulls this trip's dealId (SetNull), so
    // the attachment is always refreshed rather than only set at creation.
    const existingTrip = await prisma.tripGroup.findFirst({
      where: { ownerId: cameronId, name: { contains: 'Costa Rica' } },
    })
    const tripData = {
      ownerId: cameronId,
      dealId: costaRica.id,
      name: 'Costa Rica — February',
      description: 'Thinking about the Northbound rainforest trip. Dates are flexible, shout if you are in.',
      status: 'PLANNING' as const,
      targetStart: new Date(Date.now() + 120 * DAY),
      targetEnd: new Date(Date.now() + 128 * DAY),
      budgetMaxCents: 300_000,
      inviteToken: 'demo-costa-rica-invite',
    }
    const trip = existingTrip
      ? await prisma.tripGroup.update({ where: { id: existingTrip.id }, data: { dealId: costaRica.id } })
      : await prisma.tripGroup.create({ data: tripData })

    const tripMembers: [string, 'CONFIRMED' | 'INTERESTED' | 'INVITED'][] = [
      ['cameron', 'CONFIRMED'], ['sarah', 'CONFIRMED'], ['priya', 'CONFIRMED'],
      ['wes', 'INTERESTED'], ['daniel', 'INTERESTED'], ['marc', 'INTERESTED'],
      ['jordan', 'INTERESTED'], ['amelia', 'INTERESTED'], ['tomas', 'INVITED'],
    ]
    for (const [key, state] of tripMembers) {
      const userId = personaUsers.get(key)
      if (!userId) continue
      await prisma.tripMember.upsert({
        where: { tripId_userId: { tripId: trip.id, userId } },
        create: { tripId: trip.id, userId, state, isOrganiser: key === 'cameron' },
        update: { state },
      })
    }

    // Date and airport votes
    const dateOptions = ['2026-02-12', '2026-02-19', '2026-03-05']
    for (const [key] of tripMembers.slice(0, 6)) {
      const userId = personaUsers.get(key)
      if (!userId) continue
      await prisma.tripVote.upsert({
        where: { tripId_userId_kind_optionKey: { tripId: trip.id, userId, kind: 'DATE_WINDOW', optionKey: pick(dateOptions) } },
        create: { tripId: trip.id, userId, kind: 'DATE_WINDOW', optionKey: pick(dateOptions), value: 1 },
        update: {},
      }).catch(() => {})
      const airport = pick(['YYZ', 'YYZ', 'YUL', 'YVR'])
      await prisma.tripVote.upsert({
        where: { tripId_userId_kind_optionKey: { tripId: trip.id, userId, kind: 'AIRPORT', optionKey: airport } },
        create: {
          tripId: trip.id, userId, kind: 'AIRPORT', optionKey: airport,
          airportId: airportByIata.get(airport)?.id ?? null, value: 1,
        },
        update: {},
      }).catch(() => {})
    }

    const tripConversation = await prisma.conversation.upsert({
      where: { tripId: trip.id },
      create: { kind: 'TRIP', tripId: trip.id, title: trip.name },
      update: {},
    })
    for (const [key] of tripMembers) {
      const userId = personaUsers.get(key)
      if (!userId) continue
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: tripConversation.id, userId } },
        create: { conversationId: tripConversation.id, userId }, update: {},
      })
    }

    const MESSAGES: [string, string, number][] = [
      ['cameron', 'Right — Costa Rica. I have put the Northbound rainforest trip in here as a starting point.', 9],
      ['sarah', 'In. February works for me, I have the 12th to the 22nd free.', 9],
      ['priya', 'Same. Is the Monteverde section a lot of walking? I am fine either way, just planning.', 8],
      ['cameron', 'Three to five hours on the trail days, nothing technical.', 8],
      ['wes', 'Tempted. Depends whether I do Japan in Jan.', 7],
      ['daniel', 'I would come for the wildlife alone. Manuel Antonio is worth the detour.', 5],
      ['jordan', 'Honestly the hiking is not really my thing, but I would meet you on the coast for the last three days.', 4],
      ['cameron', 'That works — the last two nights are beach anyway.', 4],
      ['marc', 'What is the food situation? Genuine question.', 2],
      ['priya', 'Three dinners included, rest is on us. There is a soda in La Fortuna I want to find again.', 2],
      ['sarah', 'Voted for the 12th. Flights from Toronto are cheapest that week.', 1],
    ]
    const existingMessages = await prisma.message.count({ where: { conversationId: tripConversation.id } })
    if (existingMessages === 0) {
      for (const [key, body, daysAgo] of MESSAGES) {
        const senderId = personaUsers.get(key)
        if (!senderId) continue
        await prisma.message.create({
          data: {
            conversationId: tripConversation.id, senderId, body,
            createdAt: new Date(Date.now() - daysAgo * DAY - rndInt(0, 20) * 3_600_000),
          },
        })
      }
      await prisma.conversation.update({
        where: { id: tripConversation.id },
        data: { lastMessageAt: new Date(Date.now() - 1 * DAY) },
      })
    }
    log('Trip group', `${trip.name} (${tripMembers.length} members, ${MESSAGES.length} messages)`)
  }

  // Direct conversations
  const DIRECT_CHATS: { a: string; b: string; messages: [string, string, number][] }[] = [
    {
      a: 'cameron', b: 'sarah',
      messages: [
        ['sarah', 'Have you looked at the Patagonia one? 489 from Toronto, ten nights.', 3],
        ['cameron', 'I saw it. The W trek is the bit I actually want, but four days back to back is a lot.', 3],
        ['sarah', 'It is, but the refugios break it up. I would do it.', 2],
        ['cameron', 'Send it to the Hiking Crew and see who bites.', 2],
      ],
    },
    {
      a: 'cameron', b: 'marc',
      messages: [
        ['marc', 'The Douro trip is exactly what I have been looking for. Eight nights, two vineyard days.', 5],
        ['cameron', 'Match score said 91 for me. What did it give you?', 5],
        ['marc', '94. It flagged that I would find the pace slow, which is correct and also the point.', 4],
      ],
    },
    {
      a: 'cameron', b: 'jordan',
      messages: [
        ['jordan', 'Sent you a Punta Cana one. Before you say anything, it is 1,489 all in.', 8],
        ['cameron', 'Ha. It gave me 41%. It knows me.', 8],
        ['jordan', 'Your loss.', 7],
      ],
    },
  ]
  for (const chat of DIRECT_CHATS) {
    const aId = personaUsers.get(chat.a)
    const bId = personaUsers.get(chat.b)
    if (!aId || !bId) continue
    const directKey = [aId, bId].sort().join(':')
    const conversation = await prisma.conversation.upsert({
      where: { directKey },
      create: { kind: 'DIRECT', directKey },
      update: {},
    })
    for (const userId of [aId, bId]) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId } },
        create: { conversationId: conversation.id, userId }, update: {},
      })
    }
    const existing = await prisma.message.count({ where: { conversationId: conversation.id } })
    if (existing > 0) continue
    for (const [key, body, daysAgo] of chat.messages) {
      const senderId = personaUsers.get(key)
      if (!senderId) continue
      await prisma.message.create({
        data: { conversationId: conversation.id, senderId, body, createdAt: new Date(Date.now() - daysAgo * DAY) },
      })
    }
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(Date.now() - chat.messages[chat.messages.length - 1]![2] * DAY) },
    })
  }
  log('Direct conversations', DIRECT_CHATS.length)

  // Deal shares
  const shareDeal = allDeals.find((d) => d.destinationCountry === 'CL') ?? allDeals[0]
  if (shareDeal) {
    const sarahId = personaUsers.get('sarah')!
    await prisma.dealShare.create({
      data: {
        dealId: shareDeal.id, senderId: sarahId, target: 'USER', recipientId: cameronId,
        message: 'This is the Patagonia one.', response: 'INTERESTED',
        respondedAt: new Date(Date.now() - 2 * DAY), createdAt: new Date(Date.now() - 3 * DAY),
      },
    }).catch(() => {})
    await prisma.notification.create({
      data: {
        userId: cameronId, kind: 'DEAL_SHARED', title: 'Sarah sent you a trip',
        body: 'Patagonia: Torres del Paine W Trek', linkUrl: `/deals/${shareDeal.id}`,
        actorId: sarahId, createdAt: new Date(Date.now() - 3 * DAY),
      },
    }).catch(() => {})
  }

  // Notifications for the demo account
  await prisma.notification.createMany({
    data: [
      { userId: cameronId, kind: 'TRIP_JOINED', title: 'Priya joined Costa Rica — February', linkUrl: '/trips', createdAt: new Date(Date.now() - 1 * DAY) },
      { userId: cameronId, kind: 'CONNECTION_REQUEST', title: 'Nina wants to connect', linkUrl: '/people', createdAt: new Date(Date.now() - 2 * DAY) },
      { userId: cameronId, kind: 'NEW_MATCH', title: 'A new 92% match departing Toronto', linkUrl: '/discover', createdAt: new Date(Date.now() - 4 * DAY) },
    ],
  }).catch(() => {})

  // ── 12. SUBSCRIPTION FOR THE DEMO ACCOUNT ────────────────────────────────
  // Marked clearly as a seeded demonstration subscription — no Stripe object
  // exists behind it, and the admin portal labels it as such.
  await prisma.subscription.upsert({
    where: { userId: cameronId },
    create: {
      userId: cameronId, status: 'ACTIVE',
      priceCents: Number(process.env.MEMBERSHIP_PRICE_CENTS ?? 9900),
      currency: process.env.MEMBERSHIP_CURRENCY ?? 'CAD', interval: 'year',
      currentPeriodStart: new Date(Date.now() - 30 * DAY),
      currentPeriodEnd: new Date(Date.now() + 335 * DAY),
    },
    update: { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 335 * DAY) },
  })
  // A second persona on a free account, so the paywall can be demonstrated.
  log('Demo subscription', 'Cameron is an active member; other personas are free')

  // ── 13. ANALYTICS SAMPLE ─────────────────────────────────────────────────
  const analyticsDeals = allDeals.slice(0, 30)
  const clickData: { dealId: string; providerId: string; userId: string; outboundUrl: string; placement: string; createdAt: Date }[] = []
  for (let i = 0; i < 140; i++) {
    const deal = pick(analyticsDeals)
    const userId = pick([...personaUsers.values()])
    clickData.push({
      dealId: deal.id, providerId: deal.providerId, userId,
      outboundUrl: 'https://example.com/redirect',
      placement: pick(['feed', 'search', 'detail', 'trip']),
      createdAt: new Date(Date.now() - rndInt(0, 45) * DAY),
    })
  }
  await prisma.dealClick.createMany({ data: clickData })
  log('Outbound clicks (sample analytics)', clickData.length)

  console.log(`
✅  Seed complete.

    Investor demo account   ${PERSONA_SEEDS[0]!.email}  /  ${demoPassword}
    Administrator           ${adminEmail}  /  ${adminPassword}

    ${dealCount} demonstration deals from ${providers.length} fictional providers.
    All demonstration inventory is flagged and labelled in the interface.
`)
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedPersona(
  persona: PersonaSeed,
  password: string,
  dimByKey: Map<string, { id: string; kind: string; radarAxis: string | null; engineWeight: number; label: string }>,
  airportByIata: Map<string, { id: string }>,
  destBySlug: Map<string, { id: string }>,
): Promise<string> {
  const email = persona.email.toLowerCase()
  const user = await prisma.user.upsert({
    where: { emailNormalized: email },
    create: {
      email, emailNormalized: email,
      passwordHash: await hash(password, ARGON2),
      role: 'MEMBER', status: 'ACTIVE', emailVerifiedAt: new Date(),
      ageConfirmed18: true, ageConfirmedAt: new Date(),
      termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(),
      onboardingComplete: true,
      createdAt: new Date(Date.now() - rndInt(30, 300) * DAY),
    },
    update: { passwordHash: await hash(password, ARGON2), status: 'ACTIVE', onboardingComplete: true },
  })

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id, firstName: persona.firstName, lastInitial: persona.lastInitial,
      headline: persona.headline, bio: persona.bio,
      homeCity: persona.homeCity, homeRegion: persona.homeRegion, homeCountry: 'CA',
      ageRange: persona.ageRange, languages: persona.languages,
      countriesVisited: persona.countriesVisited, travelPace: persona.travelPace,
      photoUrl: avatarDataUri(persona.firstName, persona.avatarTint),
      photoThumbUrl: avatarDataUri(persona.firstName, persona.avatarTint),
      photoStatus: 'APPROVED',
    },
    update: {
      headline: persona.headline, bio: persona.bio,
      photoUrl: avatarDataUri(persona.firstName, persona.avatarTint),
      photoThumbUrl: avatarDataUri(persona.firstName, persona.avatarTint),
    },
  })

  await prisma.privacySetting.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id, discoverable: true,
      profileVisibility: 'PUBLIC', photoVisibility: 'PUBLIC',
      ageVisibility: 'CONNECTIONS', cityVisibility: 'PUBLIC',
      wishlistVisibility: 'CONNECTIONS', savedDealsVisibility: 'PRIVATE',
      upcomingTripVisibility: 'CONNECTIONS',
    },
    update: { discoverable: true },
  })

  await prisma.travelConstraint.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      budgetPreferred: persona.budgetPreferred, budgetMax: persona.budgetMax,
      budgetMaxIsHard: true, budgetCurrency: 'CAD',
      durationMin: persona.durationMin, durationMax: persona.durationMax,
      durationPreferred: persona.durationPreferred,
      preferredMonths: persona.preferredMonths,
      dateFlexibilityDays: 7, includeNearbyAirports: true, partySize: 1,
    },
    update: {
      budgetPreferred: persona.budgetPreferred, budgetMax: persona.budgetMax,
      durationMin: persona.durationMin, durationMax: persona.durationMax,
      durationPreferred: persona.durationPreferred, preferredMonths: persona.preferredMonths,
    },
  })

  // Airports
  for (const [rank, iata] of persona.airports.entries()) {
    const airport = airportByIata.get(iata)
    if (!airport) continue
    await prisma.userAirport.upsert({
      where: { userId_airportId: { userId: user.id, airportId: airport.id } },
      create: { userId: user.id, airportId: airport.id, rank: rank + 1 },
      update: { rank: rank + 1 },
    })
  }

  // Preferences
  const radarInputs: { dimensionKey: string; radarAxis: string | null; kind: 'RATING' | 'SPECTRUM'; engineWeight: number; rating?: number | null; spectrum?: number | null }[] = []
  for (const [key, rating] of Object.entries(persona.prefs)) {
    const dim = dimByKey.get(key)
    if (!dim) { console.warn(`    ⚠ persona ${persona.key} references unknown dimension "${key}"`); continue }
    await prisma.userPreference.upsert({
      where: { userId_dimensionId: { userId: user.id, dimensionId: dim.id } },
      create: { userId: user.id, dimensionId: dim.id, rating, source: 'ONBOARDING' },
      update: { rating },
    })
    radarInputs.push({ dimensionKey: key, radarAxis: dim.radarAxis, kind: 'RATING', engineWeight: dim.engineWeight, rating })
  }
  for (const [key, spectrum] of Object.entries(persona.spectrums)) {
    const dim = dimByKey.get(key)
    if (!dim) continue
    await prisma.userPreference.upsert({
      where: { userId_dimensionId: { userId: user.id, dimensionId: dim.id } },
      create: { userId: user.id, dimensionId: dim.id, spectrum, source: 'ONBOARDING' },
      update: { spectrum },
    })
    radarInputs.push({ dimensionKey: key, radarAxis: dim.radarAxis, kind: 'SPECTRUM', engineWeight: dim.engineWeight, spectrum })
  }

  // Wishlist
  for (const item of persona.wishlist) {
    const destination = item.destinationSlug ? destBySlug.get(item.destinationSlug) : null
    const existing = await prisma.wishlistItem.findFirst({ where: { userId: user.id, label: item.label } })
    if (existing) continue
    await prisma.wishlistItem.create({
      data: { userId: user.id, kind: item.kind, label: item.label, destinationId: destination?.id ?? null },
    })
  }

  // Travel personality, generated deterministically
  const radar = computeRadar(radarInputs)
  const topLikes = Object.entries(persona.prefs)
    .filter(([, r]) => r >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, rating]) => ({ key, label: dimByKey.get(key)?.label ?? key, rating }))
  const topDislikes = Object.entries(persona.prefs)
    .filter(([, r]) => r <= 2)
    .slice(0, 5)
    .map(([key, rating]) => ({ key, label: dimByKey.get(key)?.label ?? key, rating }))

  const personality = await fallbackAi.generateTravelerPersonality({
    firstName: persona.firstName,
    topLikes, topDislikes,
    spectrums: Object.entries(persona.spectrums).map(([key, value]) => ({
      key, label: dimByKey.get(key)?.label ?? key, lowLabel: '', highLabel: '', value,
    })),
    radar,
    budgetBand: null, tripLengthBand: null, homeCity: persona.homeCity,
  })

  await prisma.travelPersonality.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id, title: personality.title, description: personality.description,
      topInterests: personality.topInterests, tripStyles: personality.tripStyles,
      destinationIdeas: personality.destinationIdeas, idealCompanions: personality.idealCompanions,
      radar, archetypeKey: personality.archetypeKey, generatedBy: 'fallback',
    },
    update: {
      title: personality.title, description: personality.description,
      topInterests: personality.topInterests, radar, archetypeKey: personality.archetypeKey,
    },
  })

  return user.id
}

/** A generated, obviously-not-a-photograph avatar. No real person is depicted. */
function avatarDataUri(name: string, tint: string): string {
  const letter = name.charAt(0).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${tint}99"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><text x="80" y="80" font-family="Georgia, serif" font-size="68" fill="#FDFBF7" text-anchor="middle" dominant-baseline="central">${letter}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function slugify(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

/**
 * Picks a departure date in the `variant`-th month of the product's season.
 *
 * Deliberately spreads across the template's DISTINCT months rather than
 * taking the next few consecutive matches — otherwise a product that runs
 * March to May would only ever get March and April departures, and a search
 * for May would come back empty for no good reason.
 */
function pickFutureMonth(months: number[], from: Date, variant: number): Date | null {
  if (months.length === 0) return null
  const targetMonth = months[variant % months.length]!
  for (let offset = 1; offset <= 18; offset++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1))
    if (d.getUTCMonth() + 1 === targetMonth) {
      d.setUTCDate(rndInt(4, 24))
      return d
    }
  }
  return null
}

function deriveHighlights(t: DealTemplate): string[] {
  const out: string[] = []
  const top = Object.entries(t.attributes).filter(([, v]) => v >= 0.8).map(([k]) => k)
  const LABELS: Record<string, string> = {
    hiking: 'Hiking', wildlife: 'Wildlife', wine: 'Wine', food: 'Food',
    beaches: 'Beaches', skiing: 'Skiing', 'local-culture': 'Local culture',
    history: 'History', architecture: 'Architecture', 'small-groups': 'Small group',
    yoga: 'Yoga', sailing: 'Sailing', 'all-inclusive': 'All-inclusive',
    'meeting-new-people': 'Meeting people', nightlife: 'Nightlife',
    photography: 'Photography', mountains: 'Mountains', 'road-trips': 'Road trip',
    cruises: 'Small-ship cruising', golf: 'Golf', 'cooking-classes': 'Cooking classes',
  }
  for (const key of top) if (LABELS[key]) out.push(LABELS[key])
  return out.slice(0, 5)
}

function deriveTags(t: DealTemplate): string[] {
  const out = new Set<string>()
  for (const style of t.tripStyle) {
    if (style.includes('hiking')) out.add('hiking')
    if (style.includes('food')) out.add('food-wine')
    if (style === 'ski') out.add('ski')
    if (style === 'cruise') out.add('cruise')
    if (style === 'wellness') out.add('wellness')
    if (style === 'city-break') out.add('city-break')
    if (style === 'all-inclusive') out.add('all-inclusive')
    if (style === 'road-trip') out.add('road-trip')
    if (style === 'solo-friendly') out.add('solo-friendly')
    if (style === 'cultural') out.add('culture')
    if (style.includes('adventure')) out.add('adventure')
  }
  if ((t.attributes.beaches ?? 0) > 0.8) out.add('beach')
  if ((t.attributes.wildlife ?? 0) > 0.85) out.add('safari')
  if ((t.groupSizeMax ?? 99) <= 16) out.add('small-group')
  if (t.nights <= 4) out.add('weekend')
  if (t.country === 'CA') out.add('domestic')
  if (t.provider === 'atlas-flash') out.add('last-minute')
  return [...out]
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (error) => {
    console.error('\n❌ Seed failed:\n', error)
    await prisma.$disconnect()
    process.exit(1)
  })
