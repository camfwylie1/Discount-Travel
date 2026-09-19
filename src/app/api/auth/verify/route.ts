import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { fail, handler, ok } from '@/lib/api'
import { track } from '@/lib/analytics/events'
import { z } from 'zod'

const schema = z.object({ token: z.string().min(10).max(200) })

export const POST = handler(async (request) => {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return fail('That verification link is not valid.', 400)

  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, status: true, emailVerifiedAt: true } } },
  })

  if (!record || record.purpose !== 'EMAIL_VERIFICATION') {
    return fail('That verification link is not valid.', 400)
  }
  if (record.usedAt) {
    // Already used is not an error worth alarming anyone about.
    return ok({ verified: true, alreadyVerified: true })
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return fail('That verification link has expired. Request a new one from your settings.', 410)
  }

  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
        status: record.user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : record.user.status,
      },
    }),
  ])

  await track('email_verified', { userId: record.userId })
  return ok({ verified: true })
})
