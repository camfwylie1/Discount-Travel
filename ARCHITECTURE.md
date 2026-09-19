# Architecture

How Voyaj is put together, and why it is put together that way.

---

## The shape of it

```
                       ┌──────────────────────────────┐
  Browser  ──────────▶ │  Next.js App Router          │
  (React 19)           │  ─ Server Components render  │
                       │    pages with real data      │
                       │  ─ Client Components only    │
                       │    where there is interaction│
                       └───────────┬──────────────────┘
                                   │
            ┌──────────────────────┼───────────────────────┐
            ▼                      ▼                       ▼
   ┌─────────────────┐   ┌──────────────────┐   ┌────────────────────┐
   │ Route handlers  │   │ Domain libraries │   │  Background work   │
   │ /api/*          │   │ src/lib/*        │   │  ingestion, scores │
   │ ─ validate      │   │ ─ pure logic     │   │                    │
   │ ─ authorise     │   │ ─ no I/O in the  │   │                    │
   │ ─ rate limit    │   │   scoring code   │   │                    │
   └────────┬────────┘   └────────┬─────────┘   └─────────┬──────────┘
            └─────────────────────┼───────────────────────┘
                                  ▼
                       ┌──────────────────────┐
                       │ Prisma (driver       │
                       │ adapter) → Postgres  │
                       └──────────────────────┘

  External, all optional, all degrade honestly when absent:
    Stripe (membership)   Anthropic/OpenAI (copy)   S3 (photos)   Resend (email)
```

At a glance: **42 pages, 44 API route handlers, 61 database models, 14 unit
and integration test files, 4 browser test files.**

---

## The stack, and why

| Choice | Version | Why this one |
| --- | --- | --- |
| Next.js App Router | 16.3 | Server Components let a page query the database and render in one pass, so a deal page arrives with its match score already computed instead of flashing a spinner. |
| React | 19.3 | Required by the above. |
| TypeScript | 5.9 | The engine deals in scores, weights and money. Wrong units are the obvious bug class here, and the compiler catches them. |
| PostgreSQL | 16 | Relational data with genuine constraints. Deals, members, preferences and compatibility are deeply relational; a document store would push that work into the application. |
| Prisma | 7.10 | Typed queries and honest migrations. Uses the `@prisma/adapter-pg` driver adapter, with connection details in `prisma.config.ts` (v7 removed `url` from the datasource block). |
| Tailwind | v4 | Design tokens in a `@theme` block, no config file, no stylesheet drift. |
| Zod | v4 | Validation at every boundary, sharing one schema between the route and its types. |
| Vitest | 5 | Fast unit tests; integration tests run against a real database. |
| Playwright | 1.x | Browser tests on desktop and phone viewports. |

---

## Where things live

```
src/
  app/                    Pages and API routes (Next.js App Router)
    (marketing)/          Public: landing, pricing, FAQ, legal
    (auth)/               Sign up, sign in, verify, reset
    (app)/                Members: discover, search, deals, people, trips, chats…
    onboarding/           The quiz
    admin/                Provider compliance, data quality, imports, reports
    api/                  44 route handlers
  lib/
    recommendations/      THE ENGINE. Pure functions, no I/O, heavily tested.
    personality/          Travel DNA: radar axes, shrinkage, archetypes
    ingestion/            Fetch → normalise → validate → dedupe → publish
    ai/                   Provider abstraction + deterministic fallback
    auth/                 Sessions, guards, password hashing
    billing/              Stripe checkout, portal, webhook handling
    social/               Connections, circles, blocks, reports
    security/             Rate limiting, headers, sanitisation
    deals/                Feed assembly, search, query parsing
    privacy/              Export and deletion
    taxonomy/             The 116 preference dimensions and radar axes
    validation.ts         Every request schema, in one file
  components/             UI, grouped by area
  tests/                  Factories, integration tests
prisma/                   Schema, migrations, seed
e2e/                      Browser tests
```

### The one rule about `lib/recommendations`

**Nothing in it touches the database, the network, the clock or the
environment.** Every function takes plain data and returns plain data. That is
what makes the engine testable without a database, reproducible when a member
asks why they saw something, and impossible to accidentally couple to a
request.

Loading the data is `service.ts`'s job; scoring it is everything else's.

---

## How a page is served

Take a member opening a deal.

1. `src/app/(app)/deals/[id]/page.tsx` runs **on the server**.
2. `requireUser()` resolves the session cookie to a member, or redirects.
3. The deal, the member's preferences and their constraints are loaded.
4. `scoreDeal()` — a pure function — returns a score, the components that
   produced it, the reasons and the mismatches.
5. `scoreDealValue()` runs separately and answers a different question.
6. The page renders with all of it. The browser receives finished HTML.
7. Only the interactive parts (save, share, feedback) are Client Components.

No loading spinner, no request waterfall, no client-side scoring — and the
match explanation is generated by the same code path that produced the score,
so the two can never disagree.

---

## How a request is handled

Every route handler in `src/app/api` goes through the same four gates before it
does anything, in this order:

```ts
export const POST = handler(async (request) => {
  const auth = await apiUser()                       // 1. who is this?
  if (!auth.ok) return fail(auth.error, auth.status)

  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited                        // 2. how often?

  if (PAYWALL_ENABLED && !hasMembership(auth.user))  // 3. are they allowed?
    return fail('…is part of Voyaj membership.', 402)

  const parsed = await parseBody(request, saveDealSchema)
  if (!parsed.ok) return parsed.response             // 4. is the input sane?

  // …only now does the work happen
})
```

Authorisation is never inferred from what the browser sent. A client can ask
for anything; the server decides.

---

## Authentication: why not a library

See **ADR-001** below. Short version: Voyaj uses first-party sessions —
argon2id password hashing, opaque 256-bit tokens stored only as SHA-256 hashes,
`httpOnly` `SameSite=Lax` cookies, sliding expiry, and revocation that takes
effect on the very next request.

The full reasoning and threat model is in [SECURITY.md](SECURITY.md).

---

## The recommendation engine

A separate document, because it is the product:
**[RECOMMENDATIONS.md](RECOMMENDATIONS.md)**.

The one architectural point worth making here: **it is not a model.** It is
deterministic arithmetic with named, weighted components. The same member and
the same trip always produce the same score, the reasons are derived from the
components rather than written about them, and every rule is unit-tested. A
language model cannot be asked why it ranked something third, and cannot be
regression-tested when it changes its mind.

---

## Degrading honestly

Every external dependency is optional, and each one has a real behaviour when
it is missing — not a crash, and not a pretence that it worked.

| Missing | Behaviour |
| --- | --- |
| Stripe keys | Membership pages render with a clear "payments are not configured" state. No fake success is ever shown. |
| AI key | A deterministic provider produces real, template-written copy. It is marked as such in the admin. |
| Email provider | Verification and reset links print to the server terminal. |
| S3 | Photos are written to local disk. |

This is what `npm run verify` reports on.

---

## Architecture decision records

### ADR-001 — First-party sessions rather than NextAuth

**Decision.** Implement sessions directly.

**Context.** Voyaj's authorisation depends on facts that change *during* a
session: whether a membership is active, whether an account has been suspended,
whether a member has been promoted to moderator.

**Why not NextAuth.** Its Credentials provider forces JWT-backed sessions. A
JWT is a signed snapshot: once issued, it keeps asserting whatever was true
when it was minted until it expires. A member who cancels keeps their
membership claim. A suspended account keeps browsing. The workaround — checking
the database on every request anyway — removes the only advantage the JWT had
while keeping all of its problems.

**Consequences.** More code to own and to secure, and that code is reviewed in
[SECURITY.md](SECURITY.md). In exchange: revocation is immediate, sessions are
listable and killable, and authorisation always reflects the present.

### ADR-002 — Deal match and deal value are separate scores

**Decision.** Never combine them into one number.

**Context.** A cheap trip you would hate and a perfect trip at full price are
both bad recommendations, for opposite reasons. One blended number hides which.

**Consequences.** Two scores in the UI and more explaining to do. In exchange, a
displayed discount can never masquerade as personal fit, and value can be
withheld entirely (`score: null`, `band: 'unknown'`) when the evidence is thin —
which it often is.

### ADR-003 — Hard constraints gate, they do not penalise

**Decision.** A violated hard constraint removes a trip from consideration
entirely rather than reducing its score.

**Context.** A member who says "$3,000 is my absolute maximum" means it. A
weighted penalty lets a sufficiently attractive $4,000 trip climb back into
the feed.

**Consequences.** Feeds can come back empty, so the empty state has to be good.
It distinguishes "your filters are narrow" from "your own hard limits exclude
everything", and offers the specific change that would open things up.

### ADR-004 — Preference dimensions live in the database

**Decision.** The 116 dimensions are seeded rows, not an enum in code.

**Context.** The taxonomy will change constantly as the product learns what
members actually care about. An enum change is a deploy; a row is a row.

**Consequences.** The engine must handle a member having no answer for a
dimension, and a dimension disappearing. Both are covered by tests.

### ADR-005 — Compliance is step zero of ingestion

**Decision.** The pipeline refuses to *fetch* from a provider whose compliance
record does not permit that method, before parsing anything.

**Context.** "It is on a public website" is not permission. Gating at display
time means the copying has already happened.

**Consequences.** Voyaj cannot ingest from anyone until an agreement exists,
which is why the marketplace is demonstration data today. That is the correct
outcome. See [DATA_INGESTION.md](DATA_INGESTION.md).
