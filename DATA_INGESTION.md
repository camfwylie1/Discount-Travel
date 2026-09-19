# Data ingestion

How travel deals get into Voyaj — and, more importantly, the conditions under
which they are not allowed to.

Source: `src/lib/ingestion/`. Admin screens: `/admin/providers`,
`/admin/imports`, `/admin/quality`, `/admin/duplicates`.

---

## Read this part first

**There is no live travel inventory in this application.**

The trips you can see are demonstration data, created by `npm run seed`, marked
`isDemoContent = true` in the database, and labelled as demonstration content
everywhere they appear. They cannot be booked.

This is not because the pipeline is unfinished. The pipeline is built, tested
and working. It is because **no provider has yet given Voyaj permission**, and
the pipeline refuses to run without it.

> Information being visible on a public website does not mean it may be
> copied, stored and republished. That is a question of the provider's terms,
> of database and copyright law, and in Canada of consumer-protection rules
> about how travel prices are advertised. It is not a question of whether the
> HTTP request succeeds.

So the first thing the pipeline does is ask permission — of a database record
that a person had to fill in.

---

## Step zero: the compliance gate

`checkCompliance()` runs **before anything is fetched**, not before anything is
displayed. Gating at display time is too late: by then the copying has already
happened.

It refuses in four distinct cases, each with a reason an operator can act on:

| Situation | Response |
| --- | --- |
| No `ProviderCompliance` record | *"No compliance record exists for X. Review their terms and complete the compliance record before importing anything."* |
| `status = NOT_REVIEWED` | *"X's terms have not been reviewed. Do not import their content until someone has read their terms of service and recorded what is permitted."* |
| `status = BLOCKED` | *"X is blocked: \<recorded reason\>"* |
| Method not in `allowedMethods` | *"X does not permit ingestion by CSV_UPLOAD. Permitted methods: API."* |

A refusal throws `ComplianceError`. There is no override flag, and adding one
would defeat the purpose.

Statuses: `NOT_REVIEWED` (the default) · `UNDER_REVIEW` · `PERMITTED` ·
`PERMITTED_WITH_CONDITIONS` · `BLOCKED`.

Methods: `API` · `AFFILIATE_FEED` · `XML_FEED` · `JSON_IMPORT` · `CSV_UPLOAD` ·
`MANUAL_ENTRY` · `STRUCTURED_EXTRACTION`.

Permission is recorded per method. A provider who publishes an affiliate feed
has not thereby agreed to be scraped.

### Framing is a separate permission again

`framingPermitted` controls whether a provider's own pages may be displayed
inside Voyaj's in-app viewer. It defaults to false and is recorded by a person,
like everything else here.

It is deliberately not implied by any ingestion permission. Agreeing that we
may index your listings is not agreeing that your website may be shown inside
our app — that puts your content in our chrome, which most terms prohibit, and
which would blur the line this product depends on between a search service and
a seller. Where it is not granted, the provider's page opens in its own tab.

### Conditions travel with the permission

Where a provider permits ingestion *with conditions*, those conditions are
carried out of the gate and enforced, not filed away:

- `attributionRequired` / `attributionText` — displayed with the deal.
- `maxCacheHours` / `cachingRestrictions` — how long their data may be held.
- `imageUseRestricted` — whether their photography may be shown at all.

### Credentials are never stored in the database

`ProviderCompliance.apiCredentialEnvKey` holds the **name** of an environment
variable — `"PROVIDER_XYZ_API_KEY"` — never the key. Secrets do not belong in a
row that is backed up, replicated and browsed in an admin screen.

---

## The pipeline

```
  0. COMPLIANCE ──▶ refuse here, before a single byte is fetched
  1. FETCH          the permitted method only
  2. PARSE          CSV / JSON / XML adapters
  3. NORMALISE      messy strings → typed values
  4. VALIDATE       errors reject the row; warnings annotate it
  5. DEDUPLICATE    against what is already stored
  6. CATEGORISE     map to preference dimensions
  7. ENRICH         AI writes copy from established facts only
  8. QUALITY CHECK  is this good enough to show anyone?
  9. STORE          with provenance and confidence
 10. INDEX          searchable
 11. PUBLISH        or hold for human review
```

Every run produces an `ImportBatch` with per-row `ImportRow` outcomes and an
`ImportLog`. Nothing is lost silently: a rejected row is visible in
`/admin/imports` with the reason it was rejected.

---

## Normalising is where the bugs live

Supply data is messy in specific, repeated ways. Five real bugs found by
testing `normalize.ts`, each now covered:

| Input | Was | Now |
| --- | --- | --- |
| `"1,299"` | `130` cents — the comma read as a decimal point | `129900` cents |
| `"7 nights"` | `null` — the pattern wanted the singular | `7` |
| `"*HOT DEAL* Tuscany"` | `"DEAL* Tuscany"` — the promo strip ran once | `"Tuscany"` |
| `"tuscany wine tour"` | left lowercase | `"Tuscany Wine Tour"` |
| unknown boolean | `false` | `null` |

The last one is a principle, not a parse fix. **An unknown value is not
`false`.** "We do not know whether flights are included" and "flights are not
included" are different statements, and only one of them is safe to show a
member about to spend three thousand dollars. `parseBoolean` returns `null`,
and `null` renders as **"Not specified"**.

The thousands-separator bug is the one worth dwelling on: it made a $1,299 trip
look like a $1.30 trip. It would have passed every budget constraint ever set
and appeared as the most extraordinary deal in the marketplace. Money parsing
gets a unit test for every format the supply actually contains.

---

## Deduplicating

The same trip reaches Voyaj through several providers with different titles,
rounded prices and dates a day apart.

`compareDeals()` scores similarity across normalised title, provider,
destination, departure window, duration and price proximity. Confident matches
are merged; uncertain ones become a `DuplicateCandidate` for a human to judge
at `/admin/duplicates`.

Automatically merging an uncertain match destroys a real trip. Leaving a
duplicate in the feed is untidy. The asymmetry decides the default.

---

## Quality gate

Before a deal is published it must have: a price, a currency, a destination, a
departure window, a provider, at least one usable image (unless that provider's
images are restricted), and a confidence score for its price above threshold.

Deals that fail are held, not discarded, and appear in `/admin/quality`
alongside the stale ones — anything not re-checked in
`STALE_AFTER_HOURS` (72) hours.

Staleness is treated as a serious defect rather than an untidiness. A price
shown as current that is three days old is the single most damaging thing this
product could get wrong: it is the claim a member acts on with their own money.

---

## Provenance

Every attribute stored carries where it came from:

| `source` | Meaning |
| --- | --- |
| `SOURCE` | The provider stated it |
| `AI` | A model inferred it |
| `RULE` | Derived from destination or trip-type rules |
| `ADMIN` | A person set it |

This is what lets the engine weight a stated fact above an inferred one, lets
the UI decline to claim something on thin evidence, and lets group
disagreements be restricted to facts members actually told us.

---

## Legal matters requiring professional review

**None of this is legal advice.** These are the questions a Canadian lawyer
needs to answer before any live inventory is ingested.

### Before ingesting from anyone

1. **Terms of service.** Do the provider's terms permit automated access,
   storage and republication? Most standard terms prohibit exactly this. An
   affiliate agreement usually grants it explicitly — which is why affiliate
   feeds and partner APIs are the intended route.
2. **Database rights and copyright.** A compilation of deals may attract
   protection independent of the individual facts. Descriptions and photography
   are separately owned, frequently by a third party the provider licensed them
   from.
3. **Caching limits.** Many agreements cap how long data may be held and require
   deletion on termination. `maxCacheHours` exists for this; someone must fill
   it in from the actual agreement.
4. **Attribution.** Usually mandatory, often with prescribed wording.

### Canadian obligations

5. **Advertised price rules (Competition Act).** Canada requires all-in pricing
   in travel advertising: the price shown must include compulsory fees and
   taxes. Voyaj stores `salePriceCents` with inclusions, but *what the provider
   means by their price* must be established per provider before it is shown.
   Displaying a base fare as a total is a genuine regulatory exposure.
6. **Drip pricing.** Prohibited. Presenting a headline price that cannot be
   obtained is an offence, not a UX pattern.
7. **Travel agency registration.** Ontario (TICO), British Columbia (Consumer
   Protection BC) and Québec (OPC) all regulate travel selling. Voyaj's position
   is that it is a *discovery and referral* service that never takes payment for
   travel, and it links out for booking — but whether that keeps it outside
   registration is a question for counsel in each province, answered before
   launch.
8. **French language (Québec, Charter of the French Language).** Commercial
   content directed at Québec consumers has French requirements. Voyaj is
   English-only today.
9. **PIPEDA and Québec Law 25.** Member data, consent, export and deletion. See
   [SECURITY.md](SECURITY.md).
10. **Affiliate disclosure.** Where Voyaj earns commission, that relationship
    must be disclosed clearly. Sponsored placement must be identifiable as
    sponsored, and — enforced in the engine, not merely promised — **can never
    influence a compatibility score.**

### The honest position today

Voyaj has a working ingestion pipeline and **zero** providers cleared to use
it. The seeded providers carry explicit compliance records solely so the gate
can be demonstrated doing its job, including refusing.

The correct next step is commercial, not technical: affiliate or partner
agreements with providers who *want* the referral traffic. Everything needed to
switch a provider on is already built — the work is signing the agreement and
filling in the record.
