import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { logger } from '@/lib/observability/logger'

/**
 * STORAGE
 *
 * Two drivers behind one interface:
 *   "local" — writes to ./public/uploads. Perfect for development.
 *   "s3"    — any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2).
 *
 * FOUNDER NOTE: the S3 driver is written but not exercised, because it needs
 * bucket credentials only you can create. See DEPLOYMENT.md § File storage.
 */

export interface StoredFile {
  url: string
  key: string
  size: number
  contentType: string
}

export interface StorageDriver {
  readonly name: string
  put(key: string, data: Buffer, contentType: string): Promise<StoredFile>
  delete(key: string): Promise<void>
}

class LocalStorage implements StorageDriver {
  readonly name = 'local'
  private readonly root = path.join(process.cwd(), 'public', 'uploads')

  async put(key: string, data: Buffer, contentType: string): Promise<StoredFile> {
    const target = path.join(this.root, key)
    // Path traversal guard: the resolved path must stay inside the upload root.
    if (!target.startsWith(this.root + path.sep)) throw new Error('Invalid storage key.')
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, data)
    return { url: `/uploads/${key}`, key, size: data.length, contentType }
  }

  async delete(key: string): Promise<void> {
    const target = path.join(this.root, key)
    if (!target.startsWith(this.root + path.sep)) return
    await unlink(target).catch(() => {})
  }
}

/**
 * The AWS SDK is an OPTIONAL dependency — it is only needed when
 * STORAGE_DRIVER=s3, so we do not make every install carry it. The import
 * specifier is built at runtime so the bundler does not try to resolve a
 * package that may not be present.
 *
 * To switch to S3-compatible storage:  npm install @aws-sdk/client-s3
 */
const S3_SDK = '@aws-sdk/client-s3'

interface S3Module {
  S3Client: new (config: unknown) => { send: (command: unknown) => Promise<unknown> }
  PutObjectCommand: new (input: unknown) => unknown
  DeleteObjectCommand: new (input: unknown) => unknown
}

async function loadS3(): Promise<S3Module> {
  try {
    return (await import(/* webpackIgnore: true */ S3_SDK)) as unknown as S3Module
  } catch {
    throw new Error(
      'STORAGE_DRIVER is set to "s3" but the AWS SDK is not installed. Run: npm install @aws-sdk/client-s3',
    )
  }
}

class S3Storage implements StorageDriver {
  readonly name = 's3'

  async put(key: string, data: Buffer, contentType: string): Promise<StoredFile> {
    const { S3Client, PutObjectCommand } = await loadS3()
    const client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    })
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, '') ?? ''
    return { url: `${base}/${key}`, key, size: data.length, contentType }
  }

  async delete(key: string): Promise<void> {
    const { S3Client, DeleteObjectCommand } = await loadS3().catch(() => ({
      S3Client: null,
      DeleteObjectCommand: null,
    }))
    if (!S3Client || !DeleteObjectCommand) return
    const client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    })
    await client
      .send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }))
      .catch((error: unknown) => logger.warn('storage.delete_failed', { error: String(error) }))
  }
}

let driver: StorageDriver | null = null

export function storage(): StorageDriver {
  if (driver) return driver
  driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase() === 's3'
    ? new S3Storage()
    : new LocalStorage()
  return driver
}

export function generateKey(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const random = randomBytes(12).toString('hex')
  return `${prefix}/${stamp}/${random}.${extension}`
}

export function contentHash(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16)
}
