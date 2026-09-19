import type { NormalisedDeal, ValidationIssue } from './types'

/**
 * VALIDATION
 *
 * Errors block a row from being imported. Warnings do not — a deal with
 * missing information is still useful, it just carries lower confidence and
 * shows "Not specified" in the interface.
 *
 * The bar for an ERROR is deliberately low: a title, and either a price or
 * a link. Anything stricter would throw away real inventory.
 */

const MAX_FUTURE_YEARS = 3
const MAX_PRICE_CENTS = 5_000_000 // $50,000 — beyond this it is almost certainly a data error

export function validate(deal: NormalisedDeal): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // ── Errors ───────────────────────────────────────────────────────────────
  if (!deal.originalTitle || deal.originalTitle.length < 3) {
    errors.push({ field: 'title', message: 'A title is required.', severity: 'error' })
  }
  if (deal.salePriceCents === null && !deal.sourceUrl) {
    errors.push({
      field: 'price',
      message: 'A row needs either a price or a link to the provider’s page.',
      severity: 'error',
    })
  }
  if (deal.salePriceCents !== null && deal.salePriceCents <= 0) {
    errors.push({ field: 'salePrice', message: 'The price must be greater than zero.', severity: 'error' })
  }
  if (deal.salePriceCents !== null && deal.salePriceCents > MAX_PRICE_CENTS) {
    errors.push({
      field: 'salePrice',
      message: `That price is over $${MAX_PRICE_CENTS / 100}, which is almost certainly a mistake. Check whether it is in cents rather than dollars.`,
      severity: 'error',
    })
  }
  if (deal.departureDate && deal.returnDate && deal.returnDate < deal.departureDate) {
    errors.push({
      field: 'returnDate',
      message: 'The return date is before the departure date.',
      severity: 'error',
    })
  }
  if (deal.durationNights !== null && (deal.durationNights < 1 || deal.durationNights > 365)) {
    errors.push({
      field: 'durationNights',
      message: 'Trip length must be between 1 and 365 nights.',
      severity: 'error',
    })
  }

  // ── Warnings ─────────────────────────────────────────────────────────────
  const now = Date.now()
  if (deal.departureDate) {
    if (deal.departureDate.getTime() < now) {
      warnings.push({
        field: 'departureDate',
        message: 'This departure date is in the past. The deal will import but will not appear in results.',
        severity: 'warning',
      })
    }
    if (deal.departureDate.getTime() > now + MAX_FUTURE_YEARS * 365 * 86_400_000) {
      warnings.push({
        field: 'departureDate',
        message: `That departure is more than ${MAX_FUTURE_YEARS} years away. Check the date format.`,
        severity: 'warning',
      })
    }
  } else {
    warnings.push({
      field: 'departureDate',
      message: 'No departure date. This deal cannot be matched on dates.',
      severity: 'warning',
    })
  }

  if (!deal.destinationCountry) {
    warnings.push({
      field: 'destinationCountry',
      message: 'No recognised destination country. Use a 2-letter ISO code (for example CR).',
      severity: 'warning',
    })
  }
  if (!deal.departureAirportIata) {
    warnings.push({
      field: 'departureAirport',
      message: 'No departure airport. This deal will not match anyone’s departure preferences.',
      severity: 'warning',
    })
  }
  if (deal.images.length === 0) {
    warnings.push({ field: 'images', message: 'No images. The deal card will look empty.', severity: 'warning' })
  }
  if (deal.discountPercent !== null && deal.discountPercent > 80) {
    warnings.push({
      field: 'regularPrice',
      message: `A ${Math.round(deal.discountPercent)}% discount is unusually large. Verify the original price before publishing.`,
      severity: 'warning',
    })
  }
  if (deal.overallConfidence < 0.4) {
    warnings.push({
      field: 'overall',
      message: 'This record is missing a lot of information. It will show "Not specified" in several places.',
      severity: 'warning',
    })
  }
  if (deal.expiresAt && deal.expiresAt.getTime() < now) {
    warnings.push({
      field: 'expiresAt',
      message: 'This offer has already expired. It will import but will not be shown.',
      severity: 'warning',
    })
  }

  return { errors, warnings }
}
