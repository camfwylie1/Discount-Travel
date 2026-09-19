# Deployment

Getting Voyaj onto the internet, and what has to be true before it should be.

---

## Before you deploy at all

Two things are not optional.

**1. Turn off the demonstration data.**

```
SEED_DEMO_DATA=false
```

Demonstration trips must never appear on a public site. They are labelled as
demonstration content everywhere they render, but the correct number of them in
production is zero. If any exist, `npm run verify` reports the count.

**2. Have somewhere real for the deals to come from.**

Voyaj has no live inventory, by design — the ingestion pipeline refuses to
fetch from a provider without a compliance record permitting that method. A
deployment with no cleared providers is a working application with an empty
marketplace. See [DATA_INGESTION.md](DATA_INGESTION.md).

---

## What it needs

| | Minimum | Notes |
| --- | --- | --- |
| Node | 20+ | 22 LTS recommended |
| PostgreSQL | 16+ | Managed is fine — Neon, Supabase, RDS |
| Memory | 1 GB | argon2id is deliberately memory-hard |
| Storage | S3-compatible | Or local disk on a single box |

---

## Recommended: Vercel + a managed Postgres

The application is a stock Next.js app with no unusual build requirements.

1. **Create the database** with your provider of choice and copy the connection
   string.
2. **Import the repository** into Vercel. The build command is `npm run build`,
   which runs `prisma generate` first.
3. **Set the environment variables** (below).
4. **Apply the migrations** — `npm run db:deploy` against the production URL.
   Do this deliberately, not from the build step: a build that migrates is a
   build that can migrate twice concurrently.
5. **Create the Stripe webhook** and set `STRIPE_WEBHOOK_SECRET`.
6. **Deploy**, then run `npm run verify` against production configuration.

### Environment variables

Required:

```
DATABASE_URL          your production connection string
AUTH_SECRET           openssl rand -base64 48 — a NEW one, not the dev value
NEXT_PUBLIC_APP_URL   https://your-domain
SEED_DEMO_DATA        false
NODE_ENV              production
```

Strongly recommended in production:

```
STRIPE_SECRET_KEY                    sk_live_… (or sk_test_ while proving it out)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   pk_…
STRIPE_WEBHOOK_SECRET                whsec_… from the webhook endpoint
STRIPE_PRICE_ID_ANNUAL               price_… for the $99 CAD/year membership
EMAIL_DRIVER=resend
RESEND_API_KEY                       real verification and reset email
STORAGE_DRIVER=s3                    plus the S3_* variables
```

**Generate a fresh `AUTH_SECRET` for production.** Reusing the development
value means every session token ever issued in development is valid in
production.

---

## Stripe

1. Create the product and an annual CAD price in the Stripe dashboard. Put the
   price id in `STRIPE_PRICE_ID_ANNUAL`. Left blank, the application creates a
   matching test-mode product on first checkout — convenient for a demo,
   **not** what you want in production, where the price should be an object you
   control and can report on.
2. Add a webhook endpoint at `https://your-domain/api/webhooks/stripe`
   subscribed to: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

**The webhook is what grants membership.** A successful redirect grants
nothing. If the webhook is not configured, checkout will appear to succeed and
no membership will ever activate — which is the correct failure, and an obvious
one to diagnose. `npm run verify` reports a missing webhook secret as a
failure, not a warning.

Locally:

```bash
npm run stripe:listen
```

### Before taking real money

Stripe test mode proves the integration. It does not prove the business is
ready to charge. Still needed: the tax treatment of a Canadian digital
subscription (GST/HST, and QST in Québec), the auto-renewal disclosures
required by provincial consumer-protection law, and a refund policy that
matches what the terms say. See
[SECURITY.md](SECURITY.md#consumer-and-subscription).

---

## Database in production

- **Migrations:** `npm run db:deploy`. Never `db:migrate` (it wants to write new
  migrations) and never `db:reset` (it drops everything).
- **Backups:** daily at minimum, with a restore you have actually performed.
  An untested backup is a belief, not a backup.
- **Connection pooling:** required on serverless. Use your provider's pooled
  connection string; a function per request against an unpooled Postgres
  exhausts connections quickly.

---

## Running more than one instance

This is now supported. The two pieces of shared state both ride the database
rather than a broker:

- **Rate limiting.** Sign-in, sign-up, reset and checkout are counted in
  Postgres, so the limit holds across instances. High-volume buckets stay in
  process memory deliberately — see
  [SECURITY.md](SECURITY.md#where-the-count-lives).
- **Live updates.** Deal changes travel by Postgres `LISTEN`/`NOTIFY`, one
  listening connection per instance.

Budget **two extra Postgres connections per instance** beyond the pool: one
listening, one notifying. A connection sitting in `LISTEN` cannot be borrowed
for queries, so it cannot come from the pool.

Everything else is stateless. Sessions are in the database, uploads go to S3.

### Server-sent events behind a proxy

The live update stream is a long-lived response. Anything that buffers it turns
"live" into "eventually":

- **nginx**: the route sends `X-Accel-Buffering: no`; make sure it is not
  stripped, and raise `proxy_read_timeout` above the 25-second keepalive.
- **Serverless platforms**: check the maximum response duration. A platform
  that caps a response at 10 seconds will cut the stream repeatedly. The client
  reconnects automatically, so this degrades rather than breaks, but it is
  worth knowing before you diagnose it as a bug.

## Apple Pay

Apple Pay works on the **hosted Stripe Checkout** page with no setup here at
all, because that page is served from Stripe's own verified domain.

To show the Apple Pay button **inside the app** on `/upgrade`, this domain must
be verified with Apple:

1. Stripe dashboard → Settings → Payments → Apple Pay → add your domain.
2. Stripe gives you a verification file. Put its entire contents in
   `APPLE_PAY_DOMAIN_ASSOCIATION`.
3. It is served at
   `/.well-known/apple-developer-merchantid-domain-association`. Confirm with
   `curl` before asking Stripe to verify — the route returns 404 with an
   explanation when the variable is unset, which is much easier to diagnose
   than an empty 200.

Leave it unset and the express button simply does not appear. Card checkout is
unaffected.

**What has and has not been tested.** The subscription-intent route, the
webhook that actually grants membership, and the unconfigured behaviour of the
domain route are covered by tests. **The Apple Pay sheet itself has not been
exercised** — that needs a real Stripe account, a verified domain and an Apple
device. Do not describe Apple Pay as working until someone has completed a
payment on a device.

---

## After deploying

```bash
npm run verify
```

Then check by hand, because a script cannot judge these:

- [ ] Sign up works and the verification email arrives.
- [ ] The quiz completes and produces a Travel DNA profile.
- [ ] The feed ranks and explains.
- [ ] Checkout completes **and the webhook activates the membership.**
- [ ] Cancelling in the billing portal removes access on the next request.
- [ ] `SEED_DEMO_DATA=false` and no demonstration deals are visible.
- [ ] Security headers are present (`curl -I https://your-domain`).
- [ ] The privacy policy and terms carry your real legal entity.

---

## Monitoring

`SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY` are wired in and optional. All
analytics events are written to Voyaj's own database first; these are
additional sinks, not the system of record.

Worth alerting on from day one:

- Stripe webhook failures — a silent failure here means members pay and get
  nothing.
- Ingestion runs producing zero rows, which usually means a provider changed
  their feed.
- Deals not re-checked in 72 hours (`/admin/quality`) — a stale price shown as
  current is the most damaging error this product can make.
- Sign-in failure rate, which distinguishes an attack from a broken deploy.

---

## Rolling back

The application is stateless, so reverting the deployment is enough — **unless
a migration ran.** Prisma migrations are forward-only. If a release includes a
destructive migration, the rollback plan is the backup, and that should be
established before the release rather than after it.
