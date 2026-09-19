/** Sanity check: run the real recommendation engine over the seeded database. */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { scoreDeal } from '../src/lib/recommendations/dealScore'
import { explainDealMatch } from '../src/lib/recommendations/explain'
import type { DimensionMeta } from '../src/lib/recommendations/types'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

const dims = await prisma.preferenceDimension.findMany()
const dimensions = new Map<string, DimensionMeta>(
  dims.map((d) => [d.id, { id: d.id, key: d.key, label: d.label, category: d.category as DimensionMeta['category'], kind: d.kind as 'RATING' | 'SPECTRUM', engineWeight: d.engineWeight, radarAxis: d.radarAxis }]),
)
const airports = await prisma.airport.findMany()
const airportCoords = new Map(airports.map((a) => [a.iata, { latitude: a.latitude, longitude: a.longitude }]))

for (const email of ['demo@voyaj.test', 'demo.jordan@voyaj.test', 'demo.daniel@voyaj.test']) {
  const user = await prisma.user.findUnique({
    where: { emailNormalized: email },
    include: { preferences: true, constraints: true, airports: { include: { airport: true } }, profile: true, wishlist: true },
  })
  if (!user) continue

  const scoreable = {
    userId: user.id,
    preferences: user.preferences.map((p) => ({ dimensionId: p.dimensionId, rating: p.rating, spectrum: p.spectrum, peopleWeight: p.peopleWeight })),
    constraints: user.constraints ?? {},
    airports: user.airports.map((a) => ({ airportId: a.airportId, iata: a.airport.iata, rank: a.rank, latitude: a.airport.latitude, longitude: a.airport.longitude })),
    wishlistCountries: [],
    wishlistDestinationIds: user.wishlist.map((w) => w.destinationId).filter((x): x is string => !!x),
  }

  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE' },
    include: { attributes: true, departureAirport: true },
  })

  const results = deals.map((d) => ({
    deal: d,
    result: scoreDeal(scoreable, {
      dealId: d.id, attributes: d.attributes.map((a) => ({ dimensionId: a.dimensionId, intensity: a.intensity, confidence: a.confidence })),
      salePriceCents: d.salePriceCents, currency: d.currency, airfareIncluded: d.airfareIncluded,
      departureAirportId: d.departureAirportId, departureAirportIata: d.departureAirport?.iata ?? null,
      departureDate: d.departureDate, returnDate: d.returnDate, durationNights: d.durationNights,
      tripStyle: d.tripStyle, destinationCountry: d.destinationCountry, destinationIds: [],
      groupSizeMax: d.groupSizeMax, accommodationQuality: d.accommodationQuality,
      status: d.status, expiresAt: d.expiresAt,
    }, { dimensions, airportCoords }),
  }))

  const passed = results.filter((r) => r.result.passed).sort((a, b) => b.result.score - a.result.score)
  const filtered = results.filter((r) => !r.result.passed)

  console.log(`\n━━━ ${user.profile?.firstName} (${email}) ━━━`)
  console.log(`${passed.length} deals pass hard constraints, ${filtered.length} filtered out`)
  console.log(`Score range: ${passed[passed.length - 1]?.result.score}–${passed[0]?.result.score}`)
  for (const { deal, result } of passed.slice(0, 3)) {
    const ex = explainDealMatch(result)
    console.log(`\n  ${result.score}%  ${deal.normalizedTitle} (${deal.departureAirport?.iata})`)
    console.log(`         ${ex.headline}`)
    console.log(`         Loves: ${ex.loveReasons.slice(0, 4).join(' · ') || '—'}`)
    console.log(`         Fits:  ${ex.fitReasons.slice(0, 3).join(' · ') || '—'}`)
    if (ex.mismatches.length) console.log(`         But:   ${ex.mismatches.join(' · ')}`)
  }
  const worst = passed[passed.length - 1]
  if (worst) console.log(`\n  Worst match: ${worst.result.score}%  ${worst.deal.normalizedTitle}`)
}

await prisma.$disconnect()
