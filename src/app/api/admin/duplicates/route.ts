import { prisma } from '@/lib/db'
import { apiAdmin } from '@/lib/auth/guards'
import { fail, handler, ok, parseBody } from '@/lib/api'
import { audit } from '@/lib/analytics/events'
import { z } from 'zod'

const schema = z.object({
  candidateId: z.string().max(40),
  verdict: z.enum(['CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'MERGED']),
  /** Which of the pair to archive when confirming a duplicate. */
  archiveDealId: z.string().max(40).optional(),
})

/**
 * Resolves an ambiguous duplicate. Deliberately a human decision — the
 * pipeline never auto-deletes anything it is not certain about.
 */
export const POST = handler(async (request) => {
  const auth = await apiAdmin()
  if (!auth.ok) return fail(auth.error, auth.status)

  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { candidateId, verdict, archiveDealId } = parsed.data

  const candidate = await prisma.duplicateCandidate.findUnique({ where: { id: candidateId } })
  if (!candidate) return fail('That duplicate no longer exists.', 404)

  if (archiveDealId && ![candidate.dealAId, candidate.dealBId].includes(archiveDealId)) {
    return fail('That deal is not part of this duplicate pair.', 422)
  }

  await prisma.$transaction([
    prisma.duplicateCandidate.update({
      where: { id: candidateId },
      data: { verdict, reviewedBy: auth.user.id, reviewedAt: new Date() },
    }),
    ...(verdict === 'CONFIRMED_DUPLICATE' && archiveDealId
      ? [prisma.deal.update({ where: { id: archiveDealId }, data: { status: 'ARCHIVED' } })]
      : []),
  ])

  await audit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: 'duplicate.resolved',
    entityType: 'DuplicateCandidate',
    entityId: candidateId,
    after: { verdict, archiveDealId },
  })

  return ok({ verdict })
})
