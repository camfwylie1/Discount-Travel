import 'server-only'

/**
 * UPLOAD VALIDATION
 *
 * A file extension and a Content-Type header are both attacker-controlled, so
 * neither is trusted. We check the actual magic bytes, then re-encode the
 * image through sharp — which strips EXIF (including any GPS coordinates) and
 * guarantees that whatever we store really is the image we think it is.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

export interface UploadCheck {
  ok: boolean
  error?: string
  detectedType?: string
}

/** Identifies a file from its leading bytes, not from what the client claims. */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png'
  // WEBP: "RIFF" .... "WEBP"
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  // AVIF / HEIF: "ftyp" brand at offset 4
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12)
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif'
    if (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1')) {
      return 'image/heic'
    }
  }
  return null
}

export function validateImageUpload(buffer: Buffer, declaredType?: string | null): UploadCheck {
  if (buffer.length === 0) return { ok: false, error: 'That file is empty.' }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Images must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` }
  }

  const detected = sniffImageType(buffer)
  if (!detected) {
    return { ok: false, error: 'That does not look like an image. Use a JPEG, PNG or WebP.' }
  }
  if (detected === 'image/heic') {
    return {
      ok: false,
      error: 'HEIC images are not supported yet. On an iPhone, choose "Most Compatible" or export as JPEG.',
      detectedType: detected,
    }
  }
  if (!ALLOWED_IMAGE_TYPES.includes(detected as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: 'Use a JPEG, PNG or WebP image.', detectedType: detected }
  }
  // A mismatch between the claimed and the real type is a strong smell.
  if (declaredType && declaredType !== detected && !declaredType.startsWith('image/')) {
    return { ok: false, error: 'That file does not match its type.', detectedType: detected }
  }
  return { ok: true, detectedType: detected }
}

export interface ProcessedImage {
  full: Buffer
  thumb: Buffer
  width: number
  height: number
}

/**
 * Re-encodes to WebP at two sizes. This is the step that removes EXIF,
 * neutralises anything hidden in the original container, and keeps our
 * storage costs predictable.
 */
export async function processProfileImage(buffer: Buffer): Promise<ProcessedImage> {
  const sharp = (await import('sharp')).default
  const base = sharp(buffer, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate()
  const metadata = await base.metadata()

  const full = await sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize(720, 720, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()

  const thumb = await sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize(160, 160, { fit: 'cover', position: 'attention' })
    .webp({ quality: 78 })
    .toBuffer()

  return { full, thumb, width: metadata.width ?? 0, height: metadata.height ?? 0 }
}
