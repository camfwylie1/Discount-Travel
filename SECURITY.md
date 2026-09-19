# Security and privacy

What is protected, how, and what still needs a lawyer.

---

## Authentication

First-party sessions. The reasoning for not using a library is
[ADR-001](ARCHITECTURE.md#adr-001-first-party-sessions-rather-than-nextauth).

### Passwords

argon2id via `@node-rs/argon2`, at the OWASP-recommended parameters:

```ts
memoryCost: 19456,   // 19 MiB
timeCost:   2,
parallelism: 1,
```

Argon2id is memory-hard, which is what makes a GPU farm a poor investment
against it. Passwords are never logged, never returned by an API, and never
included in a data export.

Sign-in compares against a **fixed dummy hash** when the address does not
exist, so the response takes the same time either way. Without that, the login
endpoint quietly becomes an account-enumeration oracle.

### Sessions

| | |
| --- | --- |
| Token | 256 bits from `randomBytes(32)`, base64url |
| Stored as | SHA-256 hash — the primary key of the `Session` row |
| Cookie | `httpOnly`, `SameSite=Lax`, `Secure` in production |
| Lifetime | 30 days, refreshed once inside the final 15 |
| Revocation | Immediate — the row is the session |

The raw token exists only in the member's cookie. **A dump of the database
yields no usable session token**, only hashes of expired-on-sight values.

Opaque tokens rather than JWTs, deliberately: membership status, role and
suspension are checked against the database on every authenticated request, so
a cancellation, a demotion or a ban takes effect on the very next request
rather than whenever a signed snapshot happens to expire.

`timingSafeEqual` is used for token comparison.

---

## Authorisation

Every API route runs the same four gates before doing any work — identity,
rate limit, entitlement, input validation — in that order. See
[ARCHITECTURE.md](ARCHITECTURE.md#how-a-request-is-handled).

Authorisation is never inferred from what the browser sent. A client may ask
for anything; the server decides.

Blocks are enforced **in the database queries** for people discovery,
messaging, circles and trips, not in the components that render them. Filtering
in the UI means one forgotten component is a safety failure rather than a
cosmetic one.

---

## Input handling

Every request body is parsed by a Zod schema before anything touches it. All
schemas live in `src/lib/validation.ts`, so the whole input surface of the
application can be read in one sitting.

Unvalidated input never reaches the database. Queries go through Prisma, which
parameterises; no string-built SQL exists in the codebase.

User-supplied text is treated as **data, never instruction** — including where
it reaches an AI prompt. Nothing a member types in a bio or a message can
change what a prompt asks for.

---

## Rate limiting

Sliding-window limits per identity and per route class:

| Action | Limit |
| --- | --- |
| Sign in | 8 per 15 minutes |
| Sign up | 5 per hour |
| Password reset | 5 per hour |
| Messages | 60 per minute |
| Connection requests | 30 per hour |
| Uploads | 12 per hour |
| Reports | 15 per hour |
| Checkout | 10 per 15 minutes |
| Search | 120 per minute |
| Writes (general) | 240 per minute |

The connection-request and message limits are as much about harassment as about
load. A limit that only protects the servers is only half a limit.

### Where the count lives

Sign-in, sign-up, password reset and checkout are counted **in Postgres**, so
the limit means the same thing however many instances are running. Everything
else is counted in process memory.

That split is deliberate. A brute-force limit that silently relaxes as you
scale is worse than none, because it is trusted — eight password guesses per
quarter hour becomes eight times however many servers happen to be up. A search
limit being slightly loose is a shrug, and a database round trip on every
search would cost more than the precision is worth.

If the shared store cannot be reached the limiter falls back to the in-memory
one rather than failing open or taking sign-in down with it. A degraded limit
is the least-bad of the three outcomes.

---

## Cross-site request forgery

The session cookie is `SameSite=Lax`, which already stops a cross-site form
post from carrying it. That rests entirely on the browser getting SameSite
right, so state-changing requests are checked at the server too: a `POST`,
`PUT`, `PATCH` or `DELETE` must come from our own origin and must say so.

The check is **origin-based rather than a double-submit token**, and it lives in
the wrapper every route already goes through. A token would mean threading a
value through every form and every fetch, with a real chance of a route quietly
ending up unprotected because someone forgot; here a new route is protected by
existing.

Every browser sends `Origin` on a state-changing request, so a missing one is
not a browser — it is a script, and it is refused. Webhooks are exempt by path:
they authenticate by HMAC signature and have no origin to present.

Verified both ways by tests, against the running server: a forged request is
refused with 403 before the route looks at who is asking, legitimate writes
pass, and reads are untouched.

## Headers

A nonce-based Content Security Policy is set per request in
`src/middleware.ts`:

```
default-src 'self';
script-src 'self' 'nonce-<per-request>' 'strict-dynamic';
style-src  'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src    'self' data: blob: https://images.unsplash.com https://images.pexels.com;
connect-src 'self' https://api.stripe.com;
frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none';
upgrade-insecure-requests
```

`script-src` does **not** contain `'unsafe-inline'`. An injected `<script>`
cannot execute even if it reaches the page, because it will not carry the
request's nonce — which is the entire value of a CSP, and is thrown away the
moment `'unsafe-inline'` appears.

`style-src` does permit inline styles. React writes them legitimately, and the
realistic risk from CSS injection is far below that from script injection. A
policy nobody can ship protects nothing.

Also set: `Strict-Transport-Security` (2 years, `includeSubDomains`, `preload`,
production only), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`
denying camera and microphone, and `Cache-Control: no-store` on every API
response.

These are held in place by tests (`e2e/security.spec.ts`), which check both
that the policy is present and unweakened **and** that the product still works
under it — including that it is genuinely interactive, since a hydration
failure under CSP looks like a page that renders and does nothing.

---

## Showing another company's site inside ours

The in-app viewer can display a provider's own page inside Voyaj. Three things
constrain it:

- **It is opt-in per provider**, recorded on their compliance record by a
  person, and off by default. Framing a company's site uninvited is prohibited
  by most terms of service, and it undercuts the position this product depends
  on — that Voyaj is a search service with no part in the sale — by making
  their page look like ours.
- **The frame is sandboxed.** The third-party document gets no permissions
  (`allow=""`), a restrictive `sandbox` attribute, and a
  `strict-origin-when-cross-origin` referrer policy.
- **It always says whose site it is.** The bar above the frame names the
  company, shows their real host, and states that any booking is with them. A
  frame that hid that would turn a true statement into a misleading one.

## Payments

Voyaj never sees a card number. Checkout is Stripe-hosted; the browser is
redirected to Stripe and returns with a session id.

**The webhook is the single source of truth for membership.** A successful
redirect grants nothing. Only a signed `checkout.session.completed` — verified
by HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET` — activates a subscription.

This matters because the redirect URL is under the user's control and the
webhook is not. Granting access on redirect means granting access to anyone who
can type a URL.

Webhook handling is idempotent by event id; Stripe retries, and a retry must
not double-grant or double-charge. This is covered by 14 integration tests.

No payment is ever faked. With no Stripe key configured, the membership pages
render a clear "payments are not configured" state.

---

## Never inferred

This is enforced in code, not merely promised in a policy.

Voyaj does not infer, model, store or act on: **gender, sexual orientation,
ethnicity, religion, disability, or health.** Not from a name, not from a
photo, not from browsing behaviour, and not from an AI.

- Where such a thing is relevant to a member, **they state it themselves**, and
  only if they want to.
- **Community features are opt-in and default to off.** Women-only and LGBTQ+
  travel preferences are settings a member turns on, never a group they are
  placed into.
- Compatibility is computed from travel characteristics only — pace, budget,
  interests, trip length, social style and availability — and the product says
  so on the screens where it matters.
- Profile photos are used for display and nothing else. No face analysis of any
  kind.

### Age

18+ platform. Age is confirmed at signup and recorded with a timestamp. No
stranger-matching involves minors.

### Verification

**Nobody is described as verified unless a verification actually happened.**
There is no "verified" badge that means "provided an email address". Email
confirmation is described as email confirmation.

### Commercial integrity

Sponsored placement is a separate, labelled surface. **It cannot influence a
compatibility score.** The scoring code takes no commercial input — there is
nowhere for a sponsorship to enter the calculation, which is a stronger
guarantee than a policy saying it will not.

---

## Member data rights

| Right | How |
| --- | --- |
| Access | `/api/profile/export` returns everything held about the member as JSON |
| Deletion | `/api/profile/delete` — an actual delete, cascading through the schema |
| Correction | Every answer is editable from settings |
| Visibility | `/settings/privacy` controls who can see the profile and who may make contact |

Deletion is deletion. Where a record must survive for a legitimate reason — a
payment record kept for tax purposes — it is severed from the member rather
than quietly retained under their name, and the export says what is kept and
why.

---

## Secrets

- Credentials live in `.env` (git-ignored) or the host's secret store. Never in
  the repository, never in the database, never in a log, never in a client
  bundle.
- Only `NEXT_PUBLIC_*` variables reach the browser. The publishable Stripe key
  is the only public key, and it is publishable by design.
- `ProviderCompliance.apiCredentialEnvKey` stores the **name** of a variable,
  never its value. Secrets do not belong in a row that gets backed up,
  replicated and browsed in an admin screen.
- `AUTH_SECRET` is generated by `npm run setup` rather than left as a
  placeholder. A predictable signing secret is a vulnerability, not a to-do.
- `npm run verify` fails if `AUTH_SECRET` is missing, short, or still the
  placeholder.

---

## Uploads

Profile photos are checked by **content**, not by filename or the declared
content type, both of which a client chooses freely. Size-capped, re-encoded
through `sharp` — which strips EXIF, including the GPS coordinates most phones
embed — and served from a path that cannot execute.

---

## Known gaps

Listed rather than left to be discovered:

- **No automated dependency scanning** in CI yet.
- **No penetration test.** This codebase has been reviewed by its authors. That
  is not the same thing, and it should not be treated as the same thing.
- **Moderation is advisory.** A model flags; a human decides. That is the right
  design, and it means moderation capacity is a staffing question before it is
  a technical one.

---

## Legal matters requiring professional review

**Nothing in this repository is legal advice**, including the policy documents
inside the application. Those are drafts for a lawyer to work from, and each
says so where a member can see it.

### Privacy

1. **PIPEDA.** Consent, purpose limitation, retention, breach notification.
   Voyaj collects detailed preference data and needs a defensible statement of
   why each field exists.
2. **Québec Law 25.** Stricter than PIPEDA: privacy-impact assessments,
   explicit consent for profiling, a right to de-indexing, mandatory breach
   reporting, and a named privacy officer. **Profiling is the central point
   here** — Voyaj's whole product is profiling, done openly, and Law 25 requires
   it to be disclosed and separately consented to.
3. **Cross-border transfer.** If the database or any processor sits outside
   Canada, that must be disclosed.
4. **Retention.** How long is inactive member data kept? Currently
   indefinitely. That needs a policy and then an implementation.

### Consumer and subscription

5. **Auto-renewal.** Provincial consumer-protection rules govern renewal
   notices, cancellation and refunds. Québec's rules are the strictest.
6. **Negative-option billing.** Renewal must be clear at the point of purchase.
7. **All-in pricing and drip pricing (Competition Act).** See
   [DATA_INGESTION.md](DATA_INGESTION.md#canadian-obligations). This is the
   largest regulatory exposure in the product, because it bears on what price
   is displayed.

### Travel industry

8. **Registration.** TICO (Ontario), Consumer Protection BC, OPC (Québec).
   Voyaj's position is that it is a discovery and referral service that never
   takes payment for travel. Whether that keeps it outside registration is for
   counsel to confirm, per province, before launch.

### Marketing

9. **CASL.** Canada's anti-spam law is stricter than most: express consent,
   records of consent, an unsubscribe in every message. `marketingOptIn` is
   recorded per member and defaults to off.

### Platform and safety

10. **Duty of care.** Voyaj introduces people who may then travel together. The
    terms, the reporting flow, the blocking behaviour and the verification
    claims all need review with that in mind — this is not an ordinary
    e-commerce liability profile.
11. **Content liability.** Provider descriptions are republished. Where does
    responsibility sit for an inaccurate one?

### Accessibility

12. **AODA (Ontario) and the Accessible Canada Act.** WCAG 2.1 AA is the
    working target; the suite checks landmarks, labels, contrast, keyboard
    operation and touch target size, but an automated suite is not a conformance
    audit and should not be described as one.

---

## Reporting a vulnerability

Before launch, this section needs a monitored address and a stated response
time. A security contact nobody reads is worse than none, because it looks like
a commitment.
