import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { enforceRateLimit, handler, ok, parseBody } from '@/lib/api'
import { requestResetSchema } from '@/lib/validation'
import { passwordResetEmail, sendEmail } from '@/lib/email'

export const POST = handler(async (request) => {
  const limited = enforceRateLimit(request, 'passwordReset')
  if (limited) return limited

  const parsed = await parseBody(request, requestResetSchema)
  if (!parsed.ok) return parsed.response

  const user = await prisma.user.findUnique({
    where: { emailNormalized: parsed.data.email },
    include: { profile: { select: { firstName: true } } },
  })

  // Always the same response, whether or not the address exists.
  if (user && user.status !== 'DELETED' && !user.deletedAt) {
    // Invalidate any outstanding reset tokens first.
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    })
    const token = randomBytes(32).toString('base64url')
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    })
    await sendEmail(passwordResetEmail(user.email, user.profile?.firstName ?? 'there', token))
  }

  return ok({ sent: true })
})
