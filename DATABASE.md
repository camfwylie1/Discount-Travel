# Database

PostgreSQL 16, accessed through Prisma 7 with the `@prisma/adapter-pg` driver
adapter. **61 models, 29 enums**, one migration baseline.

The full schema is `prisma/schema.prisma` and every model there carries a
comment explaining why it exists. This document covers the decisions that are
not obvious from reading it.

---

## The groups

| Group | Models |
| --- | --- |
| **Identity** | `User`, `Session`, `OAuthAccount`, `VerificationToken`, `Profile`, `PrivacySetting` |
| **Preferences** | `PreferenceDimension`, `UserPreference`, `ScenarioQuestion`, `ScenarioOption`, `ScenarioEffect`, `TravelConstraint`, `TravelPersonality` |
| **Geography** | `Airport`, `UserAirport`, `Destination`, `WishlistItem` |
| **Supply** | `Provider`, `ProviderCompliance`, `Deal`, `DealImage`, `DealAttribute`, `DealInclusion`, `ItineraryDay`, `DealDestination`, `DealDeparture`, `DealPriceHistory`, `Tag`, `DealTagLink`, `DuplicateCandidate` |
| **Engagement** | `SavedDeal`, `DealShare`, `DealClick`, `DealFeedback`, `MatchScore`, `TravelerMatch`, `RecommendationEvent` |
| **Social** | `Connection`, `Circle`, `CircleMember`, `TripGroup`, `TripMember`, `TripVote`, `Conversation`, `ConversationMember`, `Message`, `MessageRead`, `Block`, `Report` |
| **Commerce** | `Subscription`, `Payment`, `PromoCode`, `Referral` |
| **Operations** | `Notification`, `ImportBatch`, `ImportRow`, `ImportLog`, `AuditLog`, `AnalyticsEvent`, `AiGeneration`, `AppSetting` |

---

## The decisions worth explaining

### `TravelConstraint` is not part of `UserPreference`

They look similar and are deliberately separate tables.

A **preference** is a matter of degree — "I like hiking, 4 out of 5" — and feeds
a weighted score. A **constraint** is absolute: "$3,000 is my maximum", "I can
only fly from YYZ or YOW", "I cannot travel before June".

Merging them invites the bug where a hard limit becomes just another weight,
and a sufficiently attractive trip climbs back over it. The separation makes
that impossible: constraints are evaluated by a gate before scoring begins,
and the engine literally cannot reach a trip that fails one.

### `Deal.confidence` is JSON, not a column

Confidence is per *field group*, not per deal. Voyaj is often certain about a
deal's price and dates while being unsure about what is included and knowing
nothing about the itinerary.

```json
{ "price": 0.95, "dates": 0.9, "inclusions": 0.4, "itinerary": 0.1 }
```

A single `confidence` float would force an average, and an average would let
high confidence about the price paper over knowing nothing about what a member
is actually buying. The UI reads these per field and shows **"Not specified"**
rather than guessing.

### `DealAttribute` records where each fact came from

```prisma
model DealAttribute {
  dimensionId String
  intensity   Float  @default(0.5)  // 0..1 — how much of this the trip has
  confidence  Float  @default(0.5)  // 0..1 — how sure we are
  /// SOURCE = stated by the provider · AI = inferred by the model
  /// RULE = derived from destination/trip-type rules · ADMIN = set by a human
  source      String @default("RULE")
  evidence    String?
}
```

`source` is the important column. A fact the provider stated (`SOURCE`) and a
fact inferred by a model (`AI`) must never be treated as equally solid.

This is what lets the engine weight a stated fact above an inferred one, lets
the UI decline to make a confident claim on thin evidence, and lets group
disagreements be filtered to those backed by real answers — Voyaj will not name
a person as unhappy with a trip on the strength of its own guess.

### `MatchScore` stores the explanation, not just the number

```prisma
model MatchScore {
  score       Float
  components  Json   // every weighted component and what it contributed
  reasons     Json   // "Very little hiking — which suits you"
  mismatches  Json   // "14 nights; you prefer about a week"
  engineVersion String
}
```

Two reasons. First, when a member asks *"why did I see this?"* six months
later, the answer must be the explanation that was actually shown — not a fresh
one from a changed engine. Second, `engineVersion` makes it possible to compare
engine revisions against real outcomes rather than opinion.

### `ProviderCompliance` is a separate model, and it gates everything

```prisma
model ProviderCompliance {
  status          ComplianceStatus  @default(NOT_REVIEWED)
  //              NOT_REVIEWED | UNDER_REVIEW | PERMITTED
  //              | PERMITTED_WITH_CONDITIONS | BLOCKED
  allowedMethods  IngestionMethod[] @default([])
  structuredExtractionPermitted Boolean @default(false)

  termsUrl        String?           // the terms a person actually read
  termsReviewedAt DateTime?
  termsReviewedBy String?

  attributionRequired Boolean       @default(true)
  attributionText     String?
  cachingRestrictions String?       // how long we may hold their data
  maxCacheHours       Int?
  imageUseRestricted  Boolean       @default(true)

  apiCredentialEnvKey String?       // e.g. "PROVIDER_XYZ_API_KEY"
                                    // — the NAME of the variable, never the key
  blockedReason       String?
}
```

Note `apiCredentialEnvKey`. The table records *which environment variable*
holds a provider's credential. It never holds the credential. Secrets do not
belong in a database row that gets backed up, replicated and browsed in an
admin screen.

A provider's default state is `NOT_REVIEWED`, and the ingestion pipeline
refuses to fetch from it. Permission has to be recorded by a person — who read
the terms, when, and at what URL — before a single row can be pulled, and the
method being used must appear in `allowedMethods`. See
[DATA_INGESTION.md](DATA_INGESTION.md).

### `isDemoContent`

Every `Deal` carries it and it defaults to `false`. Seeded content sets it
`true`, and the flag travels with the deal into every surface that displays it.

It exists so that demonstration inventory can never be mistaken for live travel
inventory — not by a member, not by an investor watching a demo, and not by a
future developer reading the table.

### `Block` is checked in queries, not in the UI

Blocks are enforced at the data layer for people discovery, messaging, circles
and trips. Filtering in a component means one forgotten component is a safety
failure.

### Money is integer cents, always

No floats, anywhere, for money. A `priceCents Int` with a separate `currency`
column. Canada is the launch market and CAD the default, but neither is
hardcoded: the currency travels with the amount.

---

## Indexing

Indexes exist where the product actually queries:

- `Deal`: `(status, expiresAt)`, `(departureAirportId, status)`,
  `salePriceCents`, `departureDate`, `durationNights`, plus
  `(status, salePriceCents, departureDate)` for the feed's filter-then-sort.
- `UserPreference`: `(userId, dimensionId)` unique — the engine's hottest read.
- `MatchScore`: `(userId, dealId)` unique so a score is computed once, and
  `(userId, score)` for reading a member's feed back in ranked order.
- `Session`: the primary key *is* the SHA-256 hash of the token, so the
  per-request lookup is the primary key lookup. There is no column holding a
  usable token, hashed or otherwise.
- `SavedDeal`, `DealFeedback`: `(userId, dealId)` unique — one opinion each.

---

## Migrations

```bash
npm run db:migrate     # create and apply a migration in development
npm run db:deploy      # apply existing migrations (production)
npm run db:reset       # drop everything and rebuild (development only)
npm run db:studio      # browse the data in a browser
```

Prisma 7 moved the connection URL out of the schema. It now lives in
`prisma.config.ts`:

```ts
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { path: path.join('prisma', 'migrations'), seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
})
```

**Never edit an applied migration.** Write a new one.

---

## The seed

`npm run seed` builds a complete, coherent demonstration world: the 116
preference dimensions, the scenario questions, Canadian gateway airports,
destinations, providers with explicit compliance records, a marketplace of
demonstration trips across every season, and a set of demonstration members
whose preferences genuinely differ from one another — so that compatibility,
disagreement and the constraint gate can all be seen doing real work.

It is idempotent and safe to re-run.

**Everything it creates is marked as demonstration content.** Set
`SEED_DEMO_DATA=false` in production.
