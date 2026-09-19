# Voyaj — Implementation Blueprint

> Working brand name: **Voyaj**. Centralised in `src/config/brand.ts` and replaceable in one file.
> North star: **Right trip. Right people. Right price.**

## 1. Selected stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | One deployable for web + API; server components keep deal data off the client; route handlers double as the mobile API |
| Styling | Tailwind CSS v4 + a small hand-built primitive set | No heavyweight component library to fight; premium consumer look is bespoke |
| Database | PostgreSQL 16 | Relational integrity for a social graph + marketplace; JSONB only where genuinely polymorphic |
| ORM | Prisma 7 | Type-safe, real migrations, readable schema for a future hire |
| Auth | First-party database-session auth (argon2id + 256-bit opaque tokens, SHA-256 at rest) | See ADR-001 below |
| Payments | Stripe Checkout + Billing, real test mode | Apple Pay/Google Pay come free via Payment Element |
| AI | Provider abstraction (`AIService`) over Anthropic / OpenAI / deterministic fallback | No vendor lock-in; product still works with zero AI keys |
| Storage | Storage abstraction: local disk (dev) / S3-compatible (prod) | No lock-in, zero cost in dev |
| Tests | Vitest (unit + integration against real Postgres) + Playwright (E2E) | Real DB tests catch what mocks hide |
| Analytics | First-party event table + pluggable sink (PostHog-ready) | Owns its own funnel data; no vendor required to demo |
| Errors | Sentry-ready `observability` module, no-ops without a DSN | Demo never breaks for a missing key |

### ADR-001 — Why not NextAuth/Auth.js
Auth.js v5's Credentials provider cannot use database sessions, forcing JWT sessions.
For a product where **subscription status, admin role and suspension must be revocable instantly**,
stale JWT claims are a real authorization bug. We use the now-standard Lucia-style pattern:
`@node-rs/argon2` for password hashing, `crypto.getRandomValues` for tokens, SHA-256 token
hashing at rest, httpOnly/SameSite=Lax/Secure cookies, sliding expiry, instant server-side
revocation. **No custom cryptography is invented** — only standard primitives are composed.
OAuth (Apple/Google) plugs into the same `Session` table via the prepared `OAuthAccount` model.

## 2. System architecture

```
Browser / future native app
        │  (same JSON route handlers)
        ▼
Next.js App Router ── Server Components (read) ── Route Handlers (write)
        │                      │                        │
        │                      ▼                        ▼
        │              lib/recommendations       lib/billing (Stripe)
        │              (deterministic, pure)     lib/ai (abstraction)
        │                      │                 lib/ingestion (pipeline)
        ▼                      ▼                 lib/storage, lib/analytics
   lib/auth (sessions) ───► Prisma ───► PostgreSQL
```

Every write path goes through a route handler with: session guard → rate limit → Zod validation →
authorization check → service call → audit/analytics event.

## 3. Database architecture (44 models)

Grouped: **identity** (User, Session, VerificationToken, OAuthAccount, Profile, PrivacySetting) ·
**preferences** (PreferenceDimension, UserPreference, TravelConstraint, UserAirport, WishlistItem,
TravelPersonality) · **geo** (Airport, Destination) · **marketplace** (Provider, ProviderCompliance,
Deal, DealImage, DealAttribute, DealInclusion, ItineraryDay, DealTag, Tag, DuplicateCandidate) ·
**engagement** (SavedDeal, DealShare, DealClick, RecommendationEvent, DealFeedback, MatchScore) ·
**social** (Connection, Circle, CircleMember, TripGroup, TripMember, TripVote, Conversation,
ConversationMember, Message, MessageRead, Block, Report) · **money** (Subscription, Payment,
PromoCode, Referral) · **ops** (Notification, ImportBatch, ImportRow, AuditLog, AnalyticsEvent,
AiGeneration, AppSetting).

Hard constraints live in `TravelConstraint` (typed columns + `isHard` flags) — deliberately
**separate** from `UserPreference`. JSONB is used only for `Deal.providerMetadata`,
`MatchScore.components` and `ImportRow.raw`.

## 4. Major pages

Public: `/` landing · `/pricing` · `/faq` · `/deals/[slug]` (SEO) · `/legal/*`
Auth: `/signup` `/login` `/verify` `/reset`
Onboarding: `/onboarding/{welcome,scenarios,style,activities,food,culture,social,comfort,spectrums,airports,budget,photo,personality,review}`
App: `/discover` `/search` `/deals/[id]` `/saved` `/people` `/people/[id]` `/circles` `/trips` `/trips/[id]` `/chats` `/chats/[id]` `/profile` `/settings/*` `/upgrade`
Admin: `/admin` + providers, deals, imports, duplicates, users, reports, taxonomy, airports, destinations, metrics, prompts, data-quality.

## 5. Recommendation architecture (deterministic, no LLM)

Affinity mapping `a = (rating-3)/2 ∈ [-1,1]` gives direction **and** weight (`w=|a|`), so
rating 1 = active aversion, not merely "no bonus". Deal intensity `x∈[0,1]` is recentred to
`t = (2x-1)·confidence`. Interest fit = `Σ(aᵢ·tᵢ)/Σ|aᵢ|` ∈ [-1,1]. Nine weighted components
(interest, budget, airport, dates, duration, spectrum, social, accommodation, activity) after a
hard-constraint gate. Full formula, worked examples and unit tests in `RECOMMENDATIONS.md`.
`DealValue` is computed **separately** from personality match. Explanations are derived from the
stored per-component contributions, never re-invented.

## 6. AI architecture

`AIService` capabilities: `generateTravelerPersonality`, `summarizeDeal`, `classifyDeal`,
`extractDealAttributes`, `generateMatchExplanation`, `moderateContent`, `generateTravelBio`.
Providers: Anthropic → OpenAI → **DeterministicFallback** (template-based, always available).
All output is cached in `AiGeneration` keyed by content hash, so an LLM is never called on
page load. AI output is stored in separate columns from source data and rendered under an
"AI summary" label; missing facts render as "Not specified" — never invented.

## 7. Ingestion architecture

`Source → Fetch → Parse → Normalize → Validate → Deduplicate → Categorize → AI enrich →
Quality check → Store → Index → Publish`. Adapters: CSV, JSON, XML, manual admin entry,
affiliate feed, HTTP API — each implements `SourceAdapter`. Compliance gate: a provider whose
`ProviderCompliance` does not permit a method is blocked at the pipeline entry, not at display time.

## 8. Social architecture

Symmetric `Connection` (PENDING/ACCEPTED/DECLINED) + `Block` checked in a single
`visibilityGuard`. Circles are private lists. `TripGroup` wraps a deal with interest/confirmed
states, date & airport votes. Chat = `Conversation` (DIRECT/CIRCLE/TRIP) + `Message` with
DB-backed unread counts, delivered over SSE with a polling fallback.

## 9. Payment architecture

Stripe Checkout (annual $99 CAD, price id from env, amount never hardcoded in UI) →
webhook (`checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`) →
`Subscription` row is the single source of truth. Billing Portal for cancellation/card update.
Paywall is a server-side `requireMembership()` guard, configurable per surface.

## 10. Privacy & security

Server-side authorization on every route (frontend visibility is never authorization).
Zod at every boundary. Rate limiting on auth/messaging/upload/search. Upload validation by magic
bytes + re-encode. Profile visibility PUBLIC/CONNECTIONS/PRIVATE enforced in queries, not in the UI.
No sensitive characteristic is ever inferred; LGBTQ+/women-only spaces are opt-in columns.
18+ confirmation required. Account deletion + data export implemented.

## 11. Exact MVP scope
In: auth, onboarding, personality, deal DB + importer, recommendations + explanations, search,
filters, deal detail, save/share, people matching, connections, circles, trips, chat, Stripe,
admin, analytics, seed + demo account, tests.
Out (architected, not built): live provider API syncs, direct booking, push/SMS, map view
(flagged), native apps, referral activation.

## 12. Major risks
1. **Provider data rights** — mitigated by a compliance gate that blocks ingestion, not just display.
2. **Stale inventory** — freshness fields + status lifecycle + "last checked" everywhere.
3. **AI hallucination** — AI never fills facts; separate columns; "Not specified".
4. **Cold-start social** — product is fully useful with zero connections.
5. **Scoring opacity** — every score ships with stored, reproducible explanations.

## 13. Build sequence
Scaffold → schema/migrations → auth → onboarding/preferences → deals+importer → recommendation
engine (+tests) → feed/search/detail → save/share → people/connections/circles → trips/chat →
Stripe → admin → AI layer → analytics → seed/demo → QA (lint/types/unit/e2e/build) → security
review → docs.
