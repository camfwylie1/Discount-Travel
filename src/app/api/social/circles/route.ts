import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { circleSchema } from '@/lib/validation'
import { getBlockedUserIds, getRelationship } from '@/lib/social/visibility'
import { track } from '@/lib/analytics/events'
import { z } from 'zod'

export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, circleSchema)
  if (!parsed.ok) return parsed.response

  const count = await prisma.circle.count({ where: { ownerId: auth.user.id } })
  if (count >= 25) return fail('You have reached the maximum number of circles.', 422)

  // Only people you are actually connected to can be added to a circle.
  const requested = parsed.data.memberIds ?? []
  const blocked = await getBlockedUserIds(auth.user.id)
  const allowedMembers: string[] = []
  for (const id of requested) {
    if (blocked.includes(id) || id === auth.user.id) continue
    if ((await getRelationship(auth.user.id, id)) === 'connected') allowedMembers.push(id)
  }

  const circle = await prisma.circle.create({
    data: {
      ownerId: auth.user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      colour: parsed.data.colour ?? 'terracotta',
      members: { create: allowedMembers.map((userId) => ({ userId })) },
    },
  })

  // Every circle gets a conversation, including the owner.
  const conversation = await prisma.conversation.create({
    data: {
      kind: 'CIRCLE',
      circleId: circle.id,
      title: circle.name,
      members: { create: [auth.user.id, ...allowedMembers].map((userId) => ({ userId })) },
    },
  })

  await track('circle_created', {
    userId: auth.user.id,
    properties: { members: allowedMembers.length },
  })

  return ok({ id: circle.id, name: circle.name, conversationId: conversation.id, members: allowedMembers.length }, 201)
})

const updateSchema = z.object({
  circleId: z.string().max(40),
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  addMemberIds: z.array(z.string().max(40)).max(50).optional(),
  removeMemberIds: z.array(z.string().max(40)).max(50).optional(),
})

export const PATCH = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)

  const parsed = await parseBody(request, updateSchema)
  if (!parsed.ok) return parsed.response
  const { circleId, name, description, addMemberIds, removeMemberIds } = parsed.data

  const circle = await prisma.circle.findFirst({
    where: { id: circleId, ownerId: auth.user.id },
    select: { id: true },
  })
  if (!circle) return fail('That is not one of your circles.', 403)

  if (name !== undefined || description !== undefined) {
    await prisma.circle.update({
      where: { id: circleId },
      data: { ...(name ? { name } : {}), ...(description !== undefined ? { description } : {}) },
    })
  }

  if (addMemberIds?.length) {
    const blocked = await getBlockedUserIds(auth.user.id)
    for (const userId of addMemberIds) {
      if (blocked.includes(userId) || userId === auth.user.id) continue
      if ((await getRelationship(auth.user.id, userId)) !== 'connected') continue
      await prisma.circleMember.upsert({
        where: { circleId_userId: { circleId, userId } },
        create: { circleId, userId },
        update: {},
      })
      const conversation = await prisma.conversation.findUnique({ where: { circleId } })
      if (conversation) {
        await prisma.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conversation.id, userId } },
          create: { conversationId: conversation.id, userId },
          update: { leftAt: null },
        })
      }
    }
  }

  if (removeMemberIds?.length) {
    await prisma.circleMember.deleteMany({
      where: { circleId, userId: { in: removeMemberIds } },
    })
    const conversation = await prisma.conversation.findUnique({ where: { circleId } })
    if (conversation) {
      await prisma.conversationMember.updateMany({
        where: { conversationId: conversation.id, userId: { in: removeMemberIds } },
        data: { leftAt: new Date() },
      })
    }
  }

  return ok({ updated: true })
})

export const DELETE = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const body = await request.json().catch(() => null)
  const parsed = z.object({ circleId: z.string().max(40) }).safeParse(body)
  if (!parsed.success) return fail('Which circle?', 422)

  const { count } = await prisma.circle.deleteMany({
    where: { id: parsed.data.circleId, ownerId: auth.user.id },
  })
  if (count === 0) return fail('That is not one of your circles.', 403)
  return ok({ deleted: true })
})
