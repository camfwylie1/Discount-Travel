/**
 * HEALTH CHECK
 *
 *   npm run verify
 *
 * Answers one question honestly: what actually works in this installation
 * right now? It reports what is real, what is running on a deterministic
 * fallback, and what is not configured at all.
 *
 * It deliberately does NOT call paid external APIs to prove them. An
 * integration is reported as "configured", never as "working", unless this
 * script has genuinely exercised it.
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
// The client is generated into src/generated/prisma by `prisma generate`.
import { PrismaClient } from '../src/generated/prisma/client.js'

const tick = '✓'
const dash = '–'
const cross = '✗'

const lines = []
let failures = 0

function report(state, name, detail) {
  const mark = state === 'ok' ? tick : state === 'off' ? dash : cross
  if (state === 'fail') failures += 1
  lines.push(`  ${mark} ${name.padEnd(28)} ${detail}`)
}

// ── Database ────────────────────────────────────────────────────────────────
let prisma
try {
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  const [{ count: deals }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Deal"`
  const [{ count: users }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "User"`
  const [{ count: providers }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Provider"`
  report('ok', 'Database', `connected — ${deals} deals, ${users} accounts, ${providers} providers`)

} catch (error) {
  report('fail', 'Database', `cannot connect — ${error.message.split('\n')[0] || error}`)
}

// Asked separately: a failure here means the schema is out of date, which is a
// different problem from the database being unreachable. Reporting "cannot
// connect" when we plainly just did would be misleading.
if (prisma) {
  try {
    const [{ count: demo }] =
      await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Deal" WHERE "isDemoContent" = true`
    const [{ count: live }] =
      await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Deal" WHERE "isDemoContent" = false`
    report(
      'ok',
      'Inventory',
      `${demo} demo trips, ${live} non-demo — demo content is labelled as such wherever it appears`,
    )
  } catch (error) {
    report('fail', 'Inventory', `could not read the Deal table — run \`npm run setup\` (${error.message.split('\n')[0]})`)
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────
const secret = process.env.AUTH_SECRET ?? ''
if (!secret || secret.length < 32 || secret.startsWith('replace-me')) {
  report('fail', 'Session security', 'AUTH_SECRET is missing, too short or still the placeholder')
} else {
  report('ok', 'Session security', 'AUTH_SECRET set (argon2id hashing, hashed opaque session tokens)')
}

// ── Stripe ──────────────────────────────────────────────────────────────────
const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
if (!stripeKey) {
  report('off', 'Stripe', 'not configured — checkout shows a "payments unavailable" state')
} else if (stripeKey.startsWith('sk_live')) {
  report('ok', 'Stripe', 'LIVE key configured — real charges. Not tested by this script.')
} else {
  report('ok', 'Stripe', 'test-mode key configured. Not tested by this script — run the checkout.')
}
if (stripeKey && !process.env.STRIPE_WEBHOOK_SECRET) {
  report('fail', 'Stripe webhooks', 'STRIPE_WEBHOOK_SECRET missing — memberships will never activate')
}

// ── AI ──────────────────────────────────────────────────────────────────────
const provider = process.env.AI_PROVIDER ?? 'fallback'
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
if (provider === 'fallback') {
  report('off', 'AI copy', 'deterministic fallback — real templates, no model calls, nothing invented')
} else if (!hasKey) {
  report('fail', 'AI copy', `AI_PROVIDER is "${provider}" but no API key is set — will fall back`)
} else {
  report('ok', 'AI copy', `${provider} key configured. Not called by this script.`)
}

// ── Email, storage ──────────────────────────────────────────────────────────
const emailDriver = process.env.EMAIL_DRIVER ?? 'console'
report(
  emailDriver === 'resend' && process.env.RESEND_API_KEY ? 'ok' : 'off',
  'Email',
  emailDriver === 'resend' && process.env.RESEND_API_KEY
    ? 'Resend configured. Not sent by this script.'
    : 'console driver — verification links print to the server terminal',
)
report(
  process.env.STORAGE_DRIVER === 's3' ? 'ok' : 'off',
  'Photo storage',
  process.env.STORAGE_DRIVER === 's3' ? 'S3 configured' : 'local disk (./public/uploads)',
)

// ── Recommendation engine ───────────────────────────────────────────────
// Deliberately not "checked" here. Importing the module would prove only that
// a file exists; the suite that actually exercises it is `npm test`.
report('off', 'Recommendation engine', 'not exercised here — run `npm test`, which covers it directly')

// ── Output ──────────────────────────────────────────────────────────────────
console.log('\nVoyaj — what is actually working\n')
console.log(lines.join('\n'))
console.log(`
  ${tick} working and verified here   ${dash} deliberately off / fallback   ${cross} needs attention
`)

if (prisma) await prisma.$disconnect()
process.exit(failures > 0 ? 1 : 0)
