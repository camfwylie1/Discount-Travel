import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { checkPasswordStrength, hashPassword } from '@/lib/auth/password'
import { invalidateAllSessions } from '@/lib/auth/session'
import { enforceSharedRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { performResetSchema } from '@/lib/validation'

export const POST = handler(async (request) => {
  const limited = await enforceSharedRateLimit(request, 'passwordReset')
  if (limited) return limited

  const parsed = await parseBody(request, performResetSchema)
  if (!parsed.ok) return parsed.response
  const { token, password } = parsed.data

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    include: { user: { select: { id: true, email: true } } },
  })

  if (!record || record.purpose !== 'PASSWORD_RESET' || record.usedAt) {
    return fail('That reset link is not valid. Request a new one.', 400)
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return fail('That reset link has expired. Request a new one.', 410)
  }

  const strength = checkPasswordStrength(password, record.user.email)
  if (!strength.ok) {
    return fail('Please choose a stronger password.', 422, { fields: { password: strength.problems[0]! } })
  }

  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null },
    }),
  ])

  // A password change signs out every other device. Non-negotiable.
  await invalidateAllSessions(record.userId)

  return ok({ reset: true })
})
