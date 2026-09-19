import type {
  DealAttributeInput,
  DimensionMeta,
  ScoreableDeal,
  ScoreableUser,
  UserConstraintsInput,
} from '@/lib/recommendations/types'

/** Test fixtures for the pure recommendation engine — no database required. */

export const DIMS: DimensionMeta[] = [
  { id: 'd-adventure', key: 'adventure', label: 'Adventure', category: 'TRAVEL_STYLE', kind: 'RATING', engineWeight: 1 },
  { id: 'd-luxury', key: 'luxury', label: 'Luxury', category: 'TRAVEL_STYLE', kind: 'RATING', engineWeight: 1 },
  { id: 'd-food', key: 'food', label: 'Food', category: 'FOOD_DRINK', kind: 'RATING', engineWeight: 1 },
  { id: 'd-wine', key: 'wine', label: 'Wine', category: 'FOOD_DRINK', kind: 'RATING', engineWeight: 1 },
  { id: 'd-nightlife', key: 'nightlife', label: 'Nightlife', category: 'SOCIAL', kind: 'RATING', engineWeight: 1 },
  { id: 'd-partying', key: 'partying', label: 'Partying', category: 'SOCIAL', kind: 'RATING', engineWeight: 1 },
  { id: 'd-hiking', key: 'hiking', label: 'Hiking', category: 'ACTIVITY', kind: 'RATING', engineWeight: 1 },
  { id: 'd-social', key: 'meeting-people', label: 'Meeting new people', category: 'SOCIAL', kind: 'RATING', engineWeight: 1 },
  { id: 'd-hotels', key: 'luxury-hotels', label: 'Luxury hotels', category: 'ACCOMMODATION', kind: 'RATING', engineWeight: 1 },
  { id: 'd-hostels', key: 'hostels', label: 'Hostels', category: 'ACCOMMODATION', kind: 'RATING', engineWeight: 1 },
  { id: 'd-museums', key: 'museums', label: 'Museums', category: 'CULTURE', kind: 'RATING', engineWeight: 1 },
  { id: 's-pace', key: 'pace', label: 'Pace', category: 'SPECTRUM', kind: 'SPECTRUM', engineWeight: 1, radarAxis: 'activity', poleLowLabel: 'Relaxed', poleHighLabel: 'Packed itinerary' },
  { id: 's-planning', key: 'planning', label: 'Planning', category: 'SPECTRUM', kind: 'SPECTRUM', engineWeight: 1, radarAxis: 'spontaneity', poleLowLabel: 'Planned', poleHighLabel: 'Spontaneous' },
]

export const dimensionMap = new Map(DIMS.map((d) => [d.id, d]))
export const dimByKey = (key: string) => DIMS.find((d) => d.key === key)!

export function makeUser(
  overrides: {
    prefs?: Record<string, number>
    spectrums?: Record<string, number>
    constraints?: Partial<UserConstraintsInput>
    airports?: { iata: string; rank: number }[]
    wishlistCountries?: string[]
    userId?: string
  } = {},
): ScoreableUser {
  const preferences = Object.entries(overrides.prefs ?? {}).map(([key, rating]) => ({
    dimensionId: dimByKey(key).id,
    rating,
    peopleWeight: 3,
  }))
  for (const [key, spectrum] of Object.entries(overrides.spectrums ?? {})) {
    preferences.push({ dimensionId: dimByKey(key).id, rating: null as never, spectrum, peopleWeight: 3 } as never)
  }
  return {
    userId: overrides.userId ?? 'user-1',
    preferences,
    constraints: {
      budgetMax: 250_000,
      budgetPreferred: 200_000,
      budgetMaxIsHard: true,
      durationMin: 5,
      durationMax: 12,
      durationPreferred: 7,
      dateFlexibilityDays: 7,
      includeNearbyAirports: true,
      partySize: 1,
      ...overrides.constraints,
    },
    airports: (overrides.airports ?? [{ iata: 'YYZ', rank: 1 }]).map((a, i) => ({
      airportId: `ap-${a.iata}`,
      iata: a.iata,
      rank: a.rank ?? i + 1,
      latitude: AIRPORT_COORDS[a.iata]?.latitude ?? null,
      longitude: AIRPORT_COORDS[a.iata]?.longitude ?? null,
    })),
    wishlistCountries: overrides.wishlistCountries ?? [],
    wishlistDestinationIds: [],
  }
}

export const AIRPORT_COORDS: Record<string, { latitude: number; longitude: number }> = {
  YYZ: { latitude: 43.6777, longitude: -79.6248 },
  YTZ: { latitude: 43.6275, longitude: -79.3962 },
  YHM: { latitude: 43.1736, longitude: -79.935 },
  YVR: { latitude: 49.1967, longitude: -123.1815 },
  YUL: { latitude: 45.4706, longitude: -73.7408 },
  YYC: { latitude: 51.1315, longitude: -114.0106 },
}

export const airportCoordMap = new Map(Object.entries(AIRPORT_COORDS))

export function makeDeal(
  overrides: {
    attrs?: Record<string, number | [number, number]>
    dealId?: string
    price?: number
    iata?: string
    nights?: number
    departureInDays?: number
    status?: string
    country?: string
  } & Partial<ScoreableDeal> = {},
): ScoreableDeal {
  const attributes: DealAttributeInput[] = Object.entries(overrides.attrs ?? {}).map(
    ([key, value]) => {
      const [intensity, confidence] = Array.isArray(value) ? value : [value, 0.9]
      return { dimensionId: dimByKey(key).id, intensity, confidence }
    },
  )
  const depDays = overrides.departureInDays ?? 60
  const departureDate = new Date(Date.now() + depDays * 86_400_000)
  const nights = overrides.nights ?? 7
  return {
    dealId: overrides.dealId ?? 'deal-1',
    attributes,
    salePriceCents: overrides.price ?? 180_000,
    currency: 'CAD',
    airfareIncluded: true,
    departureAirportId: `ap-${overrides.iata ?? 'YYZ'}`,
    departureAirportIata: overrides.iata ?? 'YYZ',
    alternateDepartureIatas: [],
    departureDate,
    returnDate: new Date(departureDate.getTime() + nights * 86_400_000),
    durationNights: nights,
    tripStyle: [],
    destinationCountry: overrides.country ?? 'CR',
    destinationIds: [],
    groupSizeMax: 12,
    accommodationQuality: 3,
    status: overrides.status ?? 'ACTIVE',
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    ...(overrides as Partial<ScoreableDeal>),
  }
}
