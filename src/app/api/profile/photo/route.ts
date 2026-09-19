import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { generateKey, storage } from '@/lib/storage'
import { MAX_UPLOAD_BYTES, processProfileImage, validateImageUpload } from '@/lib/security/upload'
import { track } from '@/lib/analytics/events'
import { logger } from '@/lib/observability/logger'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'upload', auth.user.id)
  if (limited) return limited

  const form = await request.formData().catch(() => null)
  const file = form?.get('photo')
  if (!file || typeof file === 'string') return fail('Choose an image to upload.', 400)
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(`Images must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, 413)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const check = validateImageUpload(buffer, file.type)
  if (!check.ok) return fail(check.error ?? 'That image could not be used.', 422)

  let processed
  try {
    processed = await processProfileImage(buffer)
  } catch (error) {
    logger.warn('photo.processing_failed', { userId: auth.user.id, error: String(error) })
    return fail('We could not process that image. Try a different one.', 422)
  }

  const store = storage()
  const fullKey = generateKey(`profiles/${auth.user.id}`, 'webp')
  const thumbKey = generateKey(`profiles/${auth.user.id}/thumb`, 'webp')

  const [full, thumb] = await Promise.all([
    store.put(fullKey, processed.full, 'image/webp'),
    store.put(thumbKey, processed.thumb, 'image/webp'),
  ])

  const previous = await prisma.profile.findUnique({
    where: { userId: auth.user.id },
    select: { photoUrl: true, photoThumbUrl: true },
  })

  await prisma.profile.update({
    where: { userId: auth.user.id },
    data: {
      photoUrl: full.url,
      photoThumbUrl: thumb.url,
      // Moderation hook: a human or an automated check can flip this to
      // APPROVED or REJECTED. The photo is visible meanwhile, per policy.
      photoStatus: 'PENDING_REVIEW',
    },
  })

  // Clean up the previous upload, but never a seeded data URI avatar.
  for (const url of [previous?.photoUrl, previous?.photoThumbUrl]) {
    if (url?.startsWith('/uploads/')) {
      await store.delete(url.replace('/uploads/', '')).catch(() => {})
    }
  }

  await track('profile_photo_uploaded', { userId: auth.user.id })
  return ok({ photoUrl: full.url, photoThumbUrl: thumb.url })
})

export const DELETE = handler(async () => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)

  const profile = await prisma.profile.findUnique({
    where: { userId: auth.user.id },
    select: { photoUrl: true, photoThumbUrl: true },
  })
  const store = storage()
  for (const url of [profile?.photoUrl, profile?.photoThumbUrl]) {
    if (url?.startsWith('/uploads/')) {
      await store.delete(url.replace('/uploads/', '')).catch(() => {})
    }
  }
  await prisma.profile.update({
    where: { userId: auth.user.id },
    data: { photoUrl: null, photoThumbUrl: null, photoStatus: 'NONE' },
  })
  return ok({ removed: true })
})
