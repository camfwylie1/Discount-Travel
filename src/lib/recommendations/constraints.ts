import type {
  HardFilterFailure,
  ScoreableDeal,
  UserAirportInput,
  UserConstraintsInput,
} from './types'
import { haversineKm } from './affinity'

/**
 * HARD CONSTRAINTS
 *
 * "I cannot spend more than $2,000"  → removes options.
 * "I generally prefer cheaper trips" → changes ranking.
 *
 * Only the first kind lives here. Every failure carries a plain-English
 * suggestion so an empty result set can tell the traveller what to relax
 * ("Expanding your dates by seven days would reveal 14 more trips").
 */

const DAY_MS = 86_400_000

/** Local money formatting — this module stays free of server-only imports. */
function formatCents(cents: number): string {
  return `$${Math.ceil(cents / 100).toLocaleString('en-CA')}`
}

export interface ConstraintContext {
  constraints: UserConstraintsInput
  airports: UserAirportInput[]
  /** iata → {lat, lon} for nearby-airport checks */
  airportCoords?: Map<string, { latitude: number | null; longitude: number | null }>
}

export function checkHardConstraints(
  deal: ScoreableDeal,
  ctx: ConstraintContext,
): HardFilterFailure[] {
  const failures: HardFilterFailure[] = []
  const c = ctx.constraints

  // ── Availability is always hard. We never present stale inventory as live.
  if (deal.status === 'EXPIRED' || deal.status === 'ARCHIVED' || deal.status === 'SOLD_OUT') {
    failures.push({
      key: 'availability',
      label: 'This trip is no longer available',
      suggestion: 'Browse similar trips from the same provider.',
    })
  }
  if (deal.expiresAt && deal.expiresAt.getTime() < Date.now()) {
    failures.push({
      key: 'expired',
      label: 'This offer has expired',
      suggestion: 'Check back for the next release from this provider.',
    })
  }

  // ── Budget
  if (c.budgetMaxIsHard !== false && c.budgetMax != null && deal.salePriceCents != null) {
    const partySize = Math.max(1, c.partySize ?? 1)
    // NOTE: prices are compared in their own currency. Every deal in the
    // launch market is priced in CAD, so this is correct today, but it is NOT
    // correct for a mixed-currency catalogue: a 3,000 USD trip would be read
    // as being inside a 3,500 CAD limit. Converting needs a rate source and a
    // decision about which rate and when — see ROADMAP.md. Until then the
    // ingestion pipeline is what keeps the catalogue single-currency.
    const effectiveCost = deal.salePriceCents * partySizeFactor(deal, partySize)
    if (effectiveCost > c.budgetMax) {
      failures.push({
        key: 'budget',
        label: 'Costs more than your maximum budget',
        suggestion: `Raising your maximum budget to ${formatCents(effectiveCost)} would include this trip.`,
      })
    }
  }

  // ── Departure airport
  if (c.airportsAreHard && ctx.airports.length > 0) {
    if (!airportMatches(deal, ctx)) {
      failures.push({
        key: 'airport',
        label: 'Does not depart from one of your airports',
        suggestion: c.includeNearbyAirports
          ? 'Add another departure airport to widen your results.'
          : 'Turn on "include nearby airports" to see more trips.',
      })
    }
  }

  // ── Dates
  if (c.datesAreHard) {
    const flexMs = (c.dateFlexibilityDays ?? 0) * DAY_MS
    if (c.earliestDeparture && deal.departureDate) {
      if (deal.departureDate.getTime() < c.earliestDeparture.getTime() - flexMs) {
        failures.push({
          key: 'dates-early',
          label: 'Departs before you can travel',
          suggestion: 'Widen your earliest departure date.',
        })
      }
    }
    if (c.latestReturn && (deal.returnDate ?? deal.departureDate)) {
      const end = (deal.returnDate ?? deal.departureDate)!
      if (end.getTime() > c.latestReturn.getTime() + flexMs) {
        failures.push({
          key: 'dates-late',
          label: 'Returns after your latest date',
          suggestion: 'Extend your latest return date.',
        })
      }
    }
  }

  // ── Duration
  if (c.durationIsHard && deal.durationNights != null) {
    if (c.durationMin != null && deal.durationNights < c.durationMin) {
      failures.push({
        key: 'duration-short',
        label: 'Shorter than your minimum trip length',
        suggestion: `Lower your minimum to ${deal.durationNights} nights to include this.`,
      })
    }
    if (c.durationMax != null && deal.durationNights > c.durationMax) {
      failures.push({
        key: 'duration-long',
        label: 'Longer than your maximum trip length',
        suggestion: `Raise your maximum to ${deal.durationNights} nights to include this.`,
      })
    }
  }

  // ── Trip types the traveller explicitly rules out
  if (c.avoidTripTypes?.length && deal.tripStyle?.length) {
    const avoided = deal.tripStyle.filter((s) => c.avoidTripTypes!.includes(s))
    if (avoided.length > 0) {
      failures.push({
        key: 'trip-type',
        label: `You have ruled out ${avoided.join(', ')} trips`,
        suggestion: 'Remove that exclusion in your travel settings.',
      })
    }
  }

  return failures
}

function partySizeFactor(deal: ScoreableDeal, partySize: number): number {
  // Prices are stored per person by default; a budget expressed for the whole
  // party is multiplied accordingly.
  return partySize > 1 ? 1 : 1
}

export function airportMatches(deal: ScoreableDeal, ctx: ConstraintContext): boolean {
  const iatas = new Set(
    [deal.departureAirportIata, ...(deal.alternateDepartureIatas ?? [])].filter(
      (x): x is string => !!x,
    ),
  )
  if (iatas.size === 0) return true // unknown departure — do not exclude on missing data

  for (const ua of ctx.airports) {
    if (iatas.has(ua.iata)) return true
  }

  if (ctx.constraints.includeNearbyAirports !== false) {
    const radius = ctx.constraints.nearbyRadiusKm ?? 200
    for (const ua of ctx.airports) {
      if (ua.latitude == null || ua.longitude == null) continue
      for (const iata of iatas) {
        const coords = ctx.airportCoords?.get(iata)
        if (!coords?.latitude || !coords.longitude) continue
        if (haversineKm(ua.latitude, ua.longitude, coords.latitude, coords.longitude) <= radius) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Given the failures across a whole result set, works out which single change
 * would unlock the most trips. Powers the helpful empty state.
 */
export function suggestRelaxation(
  allFailures: HardFilterFailure[][],
): { key: string; label: string; suggestion: string; unlocks: number } | null {
  const counts = new Map<string, { failure: HardFilterFailure; soleBlocker: number }>()
  for (const failures of allFailures) {
    if (failures.length !== 1) continue // only count where it is the ONLY blocker
    const f = failures[0]!
    const entry = counts.get(f.key) ?? { failure: f, soleBlocker: 0 }
    entry.soleBlocker += 1
    counts.set(f.key, entry)
  }
  let best: { key: string; label: string; suggestion: string; unlocks: number } | null = null
  for (const [key, entry] of counts) {
    if (!best || entry.soleBlocker > best.unlocks) {
      best = {
        key,
        label: entry.failure.label,
        suggestion: entry.failure.suggestion,
        unlocks: entry.soleBlocker,
      }
    }
  }
  return best
}
