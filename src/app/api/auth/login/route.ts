import { prisma } from '@/lib/db'
import { fakeVerify, verifyPassword } from '@/lib/auth/password'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { loginSchema } from '@/lib/validation'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { clientIp, hashIp } from '@/lib/security/rateLimit'
import { track } from '@/lib/analytics/events'

const MAX_FAILED = 10
const LOCKOUT_MINUTES = 15
/** Deliberately vague: it must not reveal whether an address is registered. */
const GENERIC_ERROR = 'That email address and password do not match.'

export const POST = handler(async (request) => {
  const parsed = await parseBody(request, loginSchema)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  // Two limits: one per address (targeted attack) and one per IP (spraying).
  const byEmail = enforceRateLimit(request, 'login', `email:${email}`)
  if (byEmail) return byEmail
  const byIp = enforceRateLimit(request, 'login', `ip:${hashIp(clientIp(request.headers))}`)
  if (byIp) return byIp

  const user = await prisma.user.findUnique({ where: { emailNormalized: email } })

  if (!user) {
    // Burn comparable time so response timing does not leak existence.
    await fakeVerify(password)
    return fail(GENERIC_ERROR, 401)
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000)
    return fail(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 429)
  }

  const valid = await verifyPassword(user.passwordHash, password)

  if (!valid) {
    const failedCount = user.failedLoginCount + 1
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failedCount,
        lockedUntil: failedCount >= MAX_FAILED ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    })
    return fail(GENERIC_ERROR, 401)
  }

  if (user.status === 'SUSPENDED') {
    return fail('This account has been suspended. Contact support if you think that is a mistake.', 403)
  }
  if (user.status === 'DELETED' || user.deletedAt) {
    return fail(GENERIC_ERROR, 401)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

  const { token, expiresAt } = await createSession(user.id, {
    ipAddress: hashIp(clientIp(request.headers)),
    userAgent: request.headers.get('user-agent'),
  })
  await setSessionCookie(token, expiresAt)

  await track('login', { userId: user.id })

  return ok({
    ok: true,
    next: user.onboardingComplete ? '/discover' : '/onboarding',
  })
})
