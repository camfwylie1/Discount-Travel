import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { airportsSchema } from '@/lib/validation'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, airportsSchema)
  if (!parsed.ok) return parsed.response
  const { iatas, temporary, temporaryDays } = parsed.data

  const airports = await prisma.airport.findMany({
    where: { iata: { in: iatas }, isActive: true },
    select: { id: true, iata: true },
  })
  if (airports.length === 0 && iatas.length > 0) {
    return fail('We do not recognise those airports.', 422)
  }

  // Order is meaningful: the first airport is the first choice.
  const ordered = iatas
    .map((iata) => airports.find((a) => a.iata === iata))
    .filter((a): a is { id: string; iata: string } => !!a)

  const temporaryUntil = temporary
    ? new Date(Date.now() + (temporaryDays ?? 30) * 86_400_000)
    : null

  await prisma.$transaction([
    // A temporary departure city replaces only other temporary entries, so it
    // never overwrites the traveller's real home airports.
    prisma.userAirport.deleteMany({
      where: { userId: auth.user.id, ...(temporary ? { isTemporary: true } : { isTemporary: false }) },
    }),
    ...ordered.map((airport, index) =>
      prisma.userAirport.upsert({
        where: { userId_airportId: { userId: auth.user.id, airportId: airport.id } },
        create: {
          userId: auth.user.id, airportId: airport.id, rank: index + 1,
          isTemporary: !!temporary, temporaryUntil,
        },
        update: { rank: index + 1, isTemporary: !!temporary, temporaryUntil },
      }),
    ),
  ])

  await prisma.matchScore.deleteMany({ where: { userId: auth.user.id } })
  return ok({ saved: ordered.map((a) => a.iata) })
})
