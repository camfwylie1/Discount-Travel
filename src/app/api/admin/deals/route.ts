import { prisma } from '@/lib/db'
import { apiAdmin } from '@/lib/auth/guards'
import { fail, handler, ok, parseBody } from '@/lib/api'
import { audit } from '@/lib/analytics/events'
import { z } from 'zod'

const updateSchema = z.object({
  dealId: z.string().max(40),
  status: z.enum(['DRAFT', 'ACTIVE', 'POSSIBLY_EXPIRED', 'EXPIRED', 'SOLD_OUT', 'UNKNOWN', 'ARCHIVED']).optional(),
  featured: z.boolean().optional(),
  featuredRank: z.number().int().min(1).max(100).nullable().optional(),
  verifiedNow: z.boolean().optional(),
})

export const PATCH = handler(async (request) => {
  const auth = await apiAdmin()
  if (!auth.ok) return fail(auth.error, auth.status)

  const parsed = await parseBody(request, updateSchema)
  if (!parsed.ok) return parsed.response
  const { dealId, verifiedNow, ...rest } = parsed.data

  const before = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { status: true, featured: true, featuredRank: true },
  })
  if (!before) return fail('That deal does not exist.', 404)

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      ...rest,
      ...(verifiedNow ? { verifiedAt: new Date(), sourceLastCheckedAt: new Date() } : {}),
    },
    select: { id: true, status: true, featured: true, featuredRank: true, verifiedAt: true },
  })

  await audit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: 'deal.updated',
    entityType: 'Deal',
    entityId: dealId,
    before,
    after: updated,
  })

  return ok(updated)
})
