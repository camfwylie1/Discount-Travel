import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { wishlistSchema } from '@/lib/validation'
import { z } from 'zod'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, wishlistSchema)
  if (!parsed.ok) return parsed.response

  const count = await prisma.wishlistItem.count({ where: { userId: auth.user.id } })
  if (count >= 60) return fail('Your wishlist is full. Remove something first.', 422)

  const existing = await prisma.wishlistItem.findFirst({
    where: { userId: auth.user.id, label: parsed.data.label },
  })
  if (existing) return ok({ id: existing.id, alreadyThere: true })

  const destination = parsed.data.destinationSlug
    ? await prisma.destination.findUnique({ where: { slug: parsed.data.destinationSlug } })
    : null

  const item = await prisma.wishlistItem.create({
    data: {
      userId: auth.user.id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      destinationId: destination?.id ?? null,
    },
  })
  await prisma.matchScore.deleteMany({ where: { userId: auth.user.id } })
  return ok({ id: item.id, label: item.label, kind: item.kind }, 201)
})

export const DELETE = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const body = await request.json().catch(() => null)
  const parsed = z.object({ id: z.string().max(40) }).safeParse(body)
  if (!parsed.success) return fail('Which item?', 422)

  // Scoped by userId so one member can never delete another member's item.
  const { count } = await prisma.wishlistItem.deleteMany({
    where: { id: parsed.data.id, userId: auth.user.id },
  })
  if (count === 0) return fail('That is not on your wishlist.', 404)
  return ok({ deleted: true })
})
