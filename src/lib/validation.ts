import { z } from 'zod'

/**
 * VALIDATION
 *
 * Every request body crosses this boundary. Nothing reaches Prisma without
 * having been parsed here first, which is our primary defence against both
 * malformed input and injection.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .email('Enter a valid email address.')
  .transform((v) => v.toLowerCase())

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'That password is too long.')

export const firstNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your first name.')
  .max(40, 'That name is too long.')
  // Letters, marks, spaces, hyphens and apostrophes — names are diverse.
  .regex(/^[\p{L}\p{M}\p{Zs}'\-.]+$/u, 'Use letters only.')

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: firstNameSchema,
  ageConfirmed: z.literal(true, { message: 'You must be 18 or over to join.' }),
  termsAccepted: z.literal(true, { message: 'Please accept the terms to continue.' }),
  marketingOptIn: z.boolean().optional().default(false),
  referralCode: z.string().trim().max(40).optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
})

export const requestResetSchema = z.object({ email: emailSchema })

export const performResetSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
})

// ── Preferences ─────────────────────────────────────────────────────────────

export const preferenceUpdateSchema = z.object({
  preferences: z
    .array(
      z.object({
        dimensionKey: z.string().min(1).max(60),
        rating: z.number().int().min(1).max(5).nullable().optional(),
        spectrum: z.number().int().min(0).max(100).nullable().optional(),
        peopleWeight: z.number().int().min(1).max(5).optional(),
      }),
    )
    .max(200),
  step: z.string().max(40).optional(),
})

export const scenarioAnswerSchema = z.object({
  answers: z
    .array(z.object({ questionKey: z.string().max(60), optionKey: z.string().max(60) }))
    .max(30),
})

export const constraintsSchema = z.object({
  budgetMax: z.number().int().min(0).max(100_000_00).nullable().optional(),
  budgetPreferred: z.number().int().min(0).max(100_000_00).nullable().optional(),
  budgetMin: z.number().int().min(0).max(100_000_00).nullable().optional(),
  budgetMaxIsHard: z.boolean().optional(),
  budgetIncludesAirfare: z.boolean().optional(),
  earliestDeparture: z.string().datetime().nullable().optional(),
  latestReturn: z.string().datetime().nullable().optional(),
  datesAreHard: z.boolean().optional(),
  dateFlexibilityDays: z.number().int().min(0).max(60).optional(),
  preferredMonths: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  weekendsOnly: z.boolean().optional(),
  durationMin: z.number().int().min(1).max(365).nullable().optional(),
  durationMax: z.number().int().min(1).max(365).nullable().optional(),
  durationPreferred: z.number().int().min(1).max(365).nullable().optional(),
  durationIsHard: z.boolean().optional(),
  airportsAreHard: z.boolean().optional(),
  includeNearbyAirports: z.boolean().optional(),
  nearbyRadiusKm: z.number().int().min(0).max(2000).optional(),
  requiresDirectFlight: z.boolean().optional(),
  avoidTripTypes: z.array(z.string().max(40)).max(30).optional(),
  partySize: z.number().int().min(1).max(20).optional(),
})

export const airportsSchema = z.object({
  iatas: z.array(z.string().regex(/^[A-Z]{3}$/)).max(12),
  temporary: z.boolean().optional(),
  temporaryDays: z.number().int().min(1).max(120).optional(),
})

export const profileSchema = z.object({
  firstName: firstNameSchema.optional(),
  lastInitial: z.string().trim().max(2).optional(),
  headline: z.string().trim().max(90).optional(),
  bio: z.string().trim().max(600).optional(),
  homeCity: z.string().trim().max(80).optional(),
  homeRegion: z.string().trim().max(60).optional(),
  ageRange: z.enum(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']).optional(),
  languages: z.array(z.string().max(40)).max(12).optional(),
  countriesVisited: z.array(z.string().max(3)).max(200).optional(),
  travelPace: z.enum(['VERY_RELAXED', 'RELAXED', 'BALANCED', 'ACTIVE', 'PACKED']).optional(),
})

const visibility = z.enum(['PUBLIC', 'CONNECTIONS', 'PRIVATE'])

export const privacySchema = z.object({
  profileVisibility: visibility.optional(),
  photoVisibility: visibility.optional(),
  ageVisibility: visibility.optional(),
  cityVisibility: visibility.optional(),
  wishlistVisibility: visibility.optional(),
  savedDealsVisibility: visibility.optional(),
  upcomingTripVisibility: visibility.optional(),
  discoverable: z.boolean().optional(),
  indexableBySearchEngines: z.boolean().optional(),
  whoCanMessage: z.enum(['ANYONE', 'CONNECTIONS', 'NOBODY']).optional(),
  whoCanInviteToTrips: z.enum(['ANYONE', 'CONNECTIONS', 'NOBODY']).optional(),
  // Voluntary community preferences. Never inferred, never on by default.
  showsAgeRangePreference: z.boolean().optional(),
  preferredAgeMin: z.number().int().min(18).max(120).nullable().optional(),
  preferredAgeMax: z.number().int().min(18).max(120).nullable().optional(),
  optInWomenOnlySpaces: z.boolean().optional(),
  optInLgbtqSpaces: z.boolean().optional(),
  optInSoloTravellers: z.boolean().optional(),
  consentAnalytics: z.boolean().optional(),
  consentPersonalisation: z.boolean().optional(),
})

export const wishlistSchema = z.object({
  kind: z.enum(['COUNTRY', 'CITY', 'EXPERIENCE']),
  label: z.string().trim().min(1).max(80),
  destinationSlug: z.string().max(80).optional(),
})

// ── Deals ───────────────────────────────────────────────────────────────────

export const saveDealSchema = z.object({
  dealId: z.string().min(1).max(40),
  /** Where in the ranked list this trip sat, so ranking quality is measurable. */
  position: z.number().int().min(0).max(10_000).optional(),
  state: z.enum(['SAVED', 'INTERESTED', 'PLANNING', 'BOOKED', 'PAST', 'NOT_INTERESTED']).optional(),
  note: z.string().trim().max(500).optional(),
})

export const dealFeedbackSchema = z.object({
  dealId: z.string().min(1).max(40),
  helpful: z.boolean().nullable().optional(),
  reason: z
    .enum(['TOO_EXPENSIVE', 'WRONG_DESTINATION', 'WRONG_DATES', 'TOO_LONG', 'TOO_SHORT', 'NOT_MY_STYLE', 'WRONG_AIRPORT', 'ACTIVITY', 'OTHER'])
    .optional(),
  detail: z.string().trim().max(300).optional(),
})

export const shareDealSchema = z.object({
  dealId: z.string().min(1).max(40),
  target: z.enum(['USER', 'CIRCLE', 'TRIP', 'LINK']),
  recipientId: z.string().max(40).optional(),
  circleId: z.string().max(40).optional(),
  tripId: z.string().max(40).optional(),
  message: z.string().trim().max(500).optional(),
})

export const shareResponseSchema = z.object({
  shareId: z.string().min(1).max(40),
  response: z.enum(['INTERESTED', 'MAYBE', 'NOT_FOR_ME']),
})

export const handoffOutcomeSchema = z.object({
  handoffId: z.string().min(1).max(40),
  /** Only ever what the member told us. Never inferred from behaviour. */
  outcome: z.enum(['BOOKED', 'NOT_BOOKED', 'STILL_THINKING']),
})

export const outboundClickSchema = z.object({
  dealId: z.string().min(1).max(40),
  placement: z.string().max(30).optional(),
  /** Where in the ranked list this trip sat, so ranking quality is measurable. */
  position: z.number().int().min(0).max(10_000).optional(),
  campaign: z.string().max(60).optional(),
})

// ── Social ──────────────────────────────────────────────────────────────────

export const connectionSchema = z.object({
  userId: z.string().min(1).max(40),
  message: z.string().trim().max(300).optional(),
})

export const connectionRespondSchema = z.object({
  connectionId: z.string().min(1).max(40),
  action: z.enum(['ACCEPT', 'DECLINE', 'WITHDRAW', 'REMOVE']),
})

export const circleSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).optional(),
  colour: z.enum(['terracotta', 'ocean', 'moss', 'gold', 'berry', 'ink']).optional(),
  memberIds: z.array(z.string().max(40)).max(100).optional(),
})

export const tripSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  dealId: z.string().max(40).optional(),
  targetStart: z.string().datetime().nullable().optional(),
  targetEnd: z.string().datetime().nullable().optional(),
  budgetMaxCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  maxMembers: z.number().int().min(2).max(60).nullable().optional(),
  isPrivate: z.boolean().optional(),
  inviteUserIds: z.array(z.string().max(40)).max(50).optional(),
})

export const tripMemberSchema = z.object({
  tripId: z.string().min(1).max(40),
  action: z.enum(['JOIN', 'INTERESTED', 'CONFIRM', 'LEAVE', 'DECLINE']),
})

export const tripVoteSchema = z.object({
  tripId: z.string().min(1).max(40),
  kind: z.enum(['DATE_WINDOW', 'AIRPORT', 'DEAL']),
  optionKey: z.string().min(1).max(60),
  value: z.number().int().min(-1).max(1),
})

export const messageSchema = z.object({
  conversationId: z.string().min(1).max(40),
  body: z.string().trim().min(1, 'Write a message first.').max(4000),
  attachment: z.object({ kind: z.literal('DEAL'), dealId: z.string().max(40) }).optional(),
})

export const startConversationSchema = z.object({ userId: z.string().min(1).max(40) })

export const blockSchema = z.object({
  userId: z.string().min(1).max(40),
  reason: z.string().trim().max(300).optional(),
})

export const reportSchema = z.object({
  kind: z.enum(['USER', 'MESSAGE', 'DEAL', 'PHOTO', 'TRIP']),
  reportedUserId: z.string().max(40).optional(),
  messageId: z.string().max(40).optional(),
  dealId: z.string().max(40).optional(),
  tripId: z.string().max(40).optional(),
  reason: z.enum(['HARASSMENT', 'SPAM', 'SCAM', 'INAPPROPRIATE', 'FAKE_PROFILE', 'MISLEADING_DEAL', 'OTHER']),
  detail: z.string().trim().max(1000).optional(),
})

// ── Search & filters ────────────────────────────────────────────────────────

export const dealFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().int().min(0).max(100_000_00).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100_000_00).optional(),
  airports: z.array(z.string().regex(/^[A-Z]{3}$/)).max(12).optional(),
  nearbyAirports: z.coerce.boolean().optional(),
  countries: z.array(z.string().max(3)).max(30).optional(),
  continents: z.array(z.string().max(40)).max(10).optional(),
  destinationSlug: z.string().max(80).optional(),
  durationBucket: z
    .enum(['weekend', '2-3', '4-6', '7', '8-10', '11-14', '15-21', '22-30', 'custom'])
    .optional(),
  durationMin: z.coerce.number().int().min(1).max(365).optional(),
  durationMax: z.coerce.number().int().min(1).max(365).optional(),
  months: z.array(z.coerce.number().int().min(1).max(12)).max(12).optional(),
  dateFrom: z.string().max(30).optional(),
  dateTo: z.string().max(30).optional(),
  tripTypes: z.array(z.string().max(40)).max(30).optional(),
  tags: z.array(z.string().max(40)).max(30).optional(),
  airfareIncluded: z.coerce.boolean().optional(),
  soloFriendly: z.coerce.boolean().optional(),
  providers: z.array(z.string().max(60)).max(40).optional(),
  sort: z.enum(['match', 'price-asc', 'price-desc', 'date', 'value', 'discount', 'newest']).optional(),
  page: z.coerce.number().int().min(1).max(200).optional(),
})

export type DealFilters = z.infer<typeof dealFilterSchema>

// ── Helpers ─────────────────────────────────────────────────────────────────

export function formatZodError(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!out[key]) out[key] = issue.message
  }
  return out
}
