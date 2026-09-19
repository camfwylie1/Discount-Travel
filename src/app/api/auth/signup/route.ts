import { randomBytes, createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { hashPassword, checkPasswordStrength } from '@/lib/auth/password'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { signupSchema } from '@/lib/validation'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { sendEmail, verificationEmail } from '@/lib/email'
import { clientIp, hashIp } from '@/lib/security/rateLimit'
import { track } from '@/lib/analytics/events'
import { logger } from '@/lib/observability/logger'

export const POST = handler(async (request) => {
  const limited = enforceRateLimit(request, 'signup')
  if (limited) return limited

  const parsed = await parseBody(request, signupSchema)
  if (!parsed.ok) return parsed.response
  const { email, password, firstName, marketingOptIn, referralCode } = parsed.data

  const strength = checkPasswordStrength(password, email)
  if (!strength.ok) {
    return fail('Please choose a stronger password.', 422, {
      fields: { password: strength.problems[0]! },
    })
  }

  const existing = await prisma.user.findUnique({ where: { emailNormalized: email } })
  if (existing) {
    // Do not confirm whether an address is registered — that is account
    // enumeration. We return the same shape as success and send an email
    // telling the real owner that someone tried to sign up again.
    await sendEmail({
      to: email,
      subject: 'Someone tried to create an account with your email',
      text: `Someone tried to sign up using this address. If that was you, sign in instead at ${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/login`,
    }).catch(() => {})
    return ok({ created: true, requiresVerification: true })
  }

  const passwordHash = await hashPassword(password)
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const user = await prisma.user.create({
    data: {
      email,
      emailNormalized: email,
      passwordHash,
      status: 'PENDING_VERIFICATION',
      ageConfirmed18: true,
      ageConfirmedAt: new Date(),
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      marketingOptIn: marketingOptIn ?? false,
      // Left null on purpose: onboardingStep records the last step the
      // traveller COMPLETED, and /onboarding resumes on the one after it.
      // Writing 'welcome' here marked it done before it had been shown, so
      // new accounts skipped the welcome screen entirely.
      profile: { create: { firstName, homeCountry: process.env.DEFAULT_MARKET_COUNTRY ?? 'CA' } },
      privacy: { create: {} },
      constraints: { create: {} },
      tokens: {
        create: {
          tokenHash,
          purpose: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + 24 * 3_600_000),
        },
      },
    },
  })

  await sendEmail(verificationEmail(email, firstName, token))

  if (referralCode) {
    await prisma.referral
      .updateMany({
        where: { code: referralCode, referredUserId: null, status: 'SENT' },
        data: { referredUserId: user.id, status: 'SIGNED_UP', signedUpAt: new Date() },
      })
      .catch((error) => logger.warn('referral.attach_failed', { error: String(error) }))
  }

  // The account is usable immediately — verification gates outbound sharing
  // and messaging, not the quiz. That keeps the funnel intact while still
  // requiring a real address before anyone can contact another member.
  const { token: sessionToken, expiresAt } = await createSession(user.id, {
    ipAddress: hashIp(clientIp(request.headers)),
    userAgent: request.headers.get('user-agent'),
  })
  await setSessionCookie(sessionToken, expiresAt)

  await track('signup_completed', { userId: user.id, properties: { marketingOptIn } })

  return ok({ created: true, requiresVerification: true, next: '/onboarding' }, 201)
})
