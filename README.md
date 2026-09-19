# Voyaj

**Right trip. Right people. Right price.**

Most travel sites ask *"where do you want to go?"*. Voyaj asks *"what kind of
traveller are you?"* — and then does the looking for you.

This repository contains a working application, not a prototype or a mockup.
Everything described below runs against a real database and is covered by a
real test suite.

---

## Contents

| If you want to… | Read |
| --- | --- |
| Get it running on your laptop | This file, "Getting started" below |
| Show it to an investor | [INVESTOR_DEMO.md](INVESTOR_DEMO.md) |
| Understand how it is built | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Understand the data | [DATABASE.md](DATABASE.md) |
| Understand how trips are matched to people | [RECOMMENDATIONS.md](RECOMMENDATIONS.md) |
| Understand where deals come from, and the legal position | [DATA_INGESTION.md](DATA_INGESTION.md) |
| Understand what the AI does and does not do | [AI.md](AI.md) |
| Understand how it is kept safe | [SECURITY.md](SECURITY.md) |
| Put it on the internet | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Know what is next | [ROADMAP.md](ROADMAP.md) |

---

## Getting started

You need **Node 20 or newer** and **PostgreSQL 16 or newer**. If you do not have
PostgreSQL, the setup script tells you exactly how to install it for your
machine.

```bash
npm install     # download the code's dependencies
npm run setup   # create your .env, create the databases, build the schema
npm run seed    # fill the marketplace with demonstration trips and accounts
npm run dev     # start the app
```

Then open **http://localhost:3000**.

The seed prints two sign-in details at the end. By default:

| Account | Email | Password |
| --- | --- | --- |
| Member | `demo@voyaj.test` | `VoyajDemo!2025` |
| Admin | `admin@voyaj.test` | `VoyajAdmin!2025` |

These are development credentials defined in `.env`. They exist only because
`SEED_DEMO_DATA` is `true`. **Set `SEED_DEMO_DATA=false` in production.**

### Is it actually working?

```bash
npm run verify
```

This prints an honest inventory of what is connected, what is deliberately
running on a fallback, and what is not configured. It never claims an external
service works unless it has genuinely been exercised.

---

## What the product does

### 1. It learns how you travel

A new member answers six scenario questions ("your perfect Saturday…"), rates
the things they might care about — activities, food and drink, culture,
comfort and company, drawn from a taxonomy of 107 preference dimensions — and
sets nine sliders between two extremes (relaxed ↔ packed itinerary, planned ↔
spontaneous, and so on).

From that, Voyaj builds a **Travel DNA** profile and gives it a name — "The
Trail Seeker", "The Quiet Wild", and so on. The name is chosen by finding the
archetype whose profile is mathematically closest to the member's, so the
description can never contradict the answers behind it.

Where a member has answered very little, the profile is pulled towards neutral
rather than allowed to swing to an extreme. Two answers should not produce a
confident personality.

### 2. It separates "is this trip for me?" from "is this a good price?"

These are two different questions and Voyaj never merges them.

- **Match score** — how well the trip suits this specific person. Built from
  nine weighted components, gated by their hard limits.
- **Deal value** — whether the price is genuinely good, judged against the
  provider's own history and comparable trips.

A trip can be a perfect match at a mediocre price, or a bargain you would hate.
Both are shown, separately and honestly. A displayed discount is never treated
as proof of value on its own.

### 3. It explains itself

Every score carries the reasons that produced it, and the mismatches too. A
member sees *"Very little hiking — which suits you"* next to *"This is a
14-night trip and you prefer about a week"*. Nothing is a black box, because a
recommendation a person cannot interrogate is a recommendation they cannot
trust.

Read [RECOMMENDATIONS.md](RECOMMENDATIONS.md) for the actual arithmetic.

### 4. It matches people, not just trips

Members can find travellers they would actually enjoy a trip with, form
circles, plan group trips and vote on options.

Group recommendations **surface disagreement rather than averaging it away**.
If a trip scores 84% for one person and 31% for another, Voyaj says so, by
name: *"Marc and Jordan would rather avoid hiking, and this trip is built
around it."* An average would have hidden the one fact that mattered.

### 5. It charges for itself

Membership is **$99 CAD a year**, taken through Stripe. The price lives in
configuration, not scattered through the code. Non-members get a genuine
preview — the quiz and their Travel DNA are free — and the marketplace,
explanations, saving and messaging are behind the membership.

---

## What is real, and what is demonstration

This distinction matters more than anything else in this repository, so it is
stated plainly.

| | Status |
| --- | --- |
| Accounts, sessions, passwords | **Real.** argon2id hashing, server-side sessions, instant revocation. |
| The recommendation engine | **Real.** Deterministic, unit-tested, no model involved. |
| Travel personality | **Real.** Computed from the member's own answers. |
| Traveller and group matching | **Real.** |
| Messaging, circles, trips, voting | **Real** database writes. |
| Stripe membership | **Real Stripe**, in test mode. No payment is ever faked. |
| The travel inventory | **Demonstration data.** See below. |
| AI-written copy | **Real**, if a key is configured; otherwise deterministic templates. Never invents deal facts. |
| Email delivery | Prints to the terminal unless a provider is configured. |

### About the travel inventory

**The trips in this application are demonstration data. They are not live
travel inventory and cannot be booked.**

They are marked `isDemoContent` in the database and labelled as demonstration
content everywhere they are displayed. `npm run verify` reports the count.

Voyaj has a complete ingestion pipeline built and tested — fetching,
normalising, de-duplicating, quality-checking and publishing deals — but it
will not ingest from a provider until that provider has a compliance record
saying the method is permitted. No such agreements exist yet. This is a
deliberate constraint, not an omission: see
[DATA_INGESTION.md](DATA_INGESTION.md).

---

## Things Voyaj will not do

These are enforced in code, not just policy:

- **It never infers sensitive characteristics.** Gender, sexual orientation,
  ethnicity, religion, disability and health are never inferred from a name, a
  photo, behaviour or a model. Where such a thing is relevant to a member, they
  state it themselves, and only if they choose to.
- **Community features are opt-in.** Women-only and LGBTQ+ travel preferences
  are off unless a member turns them on.
- **It is an 18+ platform.** Age is confirmed at signup and no stranger-matching
  involves minors.
- **It never claims someone is verified** unless a verification actually
  happened.
- **Sponsored placement can never buy a compatibility score.** Commercial
  arrangements are a separate, labelled surface.
- **The AI never invents deal information.** Where a fact is unknown, the
  product says "Not specified".

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app in development |
| `npm run setup` | First-time setup: env file, databases, schema |
| `npm run seed` | Fill the database with demonstration content |
| `npm run verify` | Honest report of what is configured and working |
| `npm test` | Unit and integration tests |
| `npm run test:e2e` | Browser tests, desktop and phone |
| `npm run test:all` | Types, lint, tests, browser tests |
| `npm run lint` | Check code style |
| `npm run db:studio` | Browse the database in your browser |
| `npm run build` | Build for production |

---

## Environment variables

Everything is documented inline in **`.env.example`**, which `npm run setup`
copies to `.env` for you. The short version:

**Required**

| Variable | Why |
| --- | --- |
| `DATABASE_URL` | Where the database lives |
| `AUTH_SECRET` | Signs cookies and hashes session tokens. Generated for you by `npm run setup`. |
| `NEXT_PUBLIC_APP_URL` | The public address of the site |

**Optional — the app runs without each of these, and says so rather than breaking**

| Variable | Without it |
| --- | --- |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout shows a clear "payments unavailable" state |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Deterministic template copy is used |
| `RESEND_API_KEY` | Verification links print to the terminal |
| `S3_*` | Photos are stored on local disk |

Credentials belong in `.env`, which is git-ignored, or in your host's secret
store. They are never committed and never sent to the browser. See
[SECURITY.md](SECURITY.md).

---

## Testing

```
npm test          266 unit and integration tests
npm run test:e2e   38 browser tests (27 desktop, 11 phone)
```

Integration tests run against a real PostgreSQL database, not a mock, because
a mocked database proves nothing about whether the application works. The
browser tests drive a real browser through the real product, including the
whole journey from the landing page to a personalised feed.

---

## Legal

Several areas of this product need review by a Canadian lawyer before launch:
privacy (PIPEDA and Québec's Law 25), subscription auto-renewal and consumer
protection rules, travel-industry registration, and the terms under which any
travel content may be republished. These are listed with specifics in
[SECURITY.md](SECURITY.md#legal-matters-requiring-professional-review) and
[DATA_INGESTION.md](DATA_INGESTION.md).

**Nothing generated in this repository is legal advice.** The policy documents
in the application are drafts for a lawyer to work from, and they say so.
