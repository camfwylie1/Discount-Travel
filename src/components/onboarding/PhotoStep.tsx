'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button } from '@/components/ui'

export function PhotoStep({
  initialUrl,
  firstName,
  nextHref,
  backHref,
}: {
  initialUrl: string | null
  firstName: string
  nextHref: string
  backHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setUploading(true)
    setError(null)

    // Instant local preview so the wait never feels broken.
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    const body = new FormData()
    body.append('photo', file)
    const response = await fetch('/api/profile/photo', { method: 'POST', body })
    const data = await response.json().catch(() => ({}))
    URL.revokeObjectURL(objectUrl)

    if (!response.ok) {
      setError(data.error ?? 'That image could not be uploaded.')
      setPreview(initialUrl)
      setUploading(false)
      return
    }
    setPreview(data.photoUrl)
    setUploading(false)
    router.refresh()
  }

  async function remove() {
    setUploading(true)
    await fetch('/api/profile/photo', { method: 'DELETE' })
    setPreview(null)
    setUploading(false)
    router.refresh()
  }

  return (
    <div>
      <div className="rounded-card border border-ink-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full bg-sand-200 ring-1 ring-ink-200">
            {preview ? (
              // A blob/data URL cannot go through next/image, and this is a
              // user-supplied avatar rather than a layout-critical asset.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your profile photo" className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-4xl text-ink-400"
                style={{ fontFamily: 'var(--font-display)' }}
                aria-hidden="true"
              >
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-semibold">Add a photo</h2>
            <p className="mt-1 text-sm text-ink-600 text-pretty">
              Only other members see it, and only according to your privacy settings. Your photo is
              your identity on Voyaj — we never use it to work anything else out about you.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
              }}
            />

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                loading={uploading}
              >
                {preview ? 'Choose a different photo' : 'Choose a photo'}
              </Button>
              {preview && (
                <Button type="button" variant="ghost" onClick={remove} disabled={uploading}>
                  Remove
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-500">JPEG, PNG or WebP, up to 8 MB.</p>
          </div>
        </div>
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-500">You can add this later.</p>
        <div className="flex gap-2">
          {backHref && (
            <Button variant="ghost" type="button" onClick={() => router.push(backHref)}>
              Back
            </Button>
          )}
          <Button
            onClick={() => startTransition(() => router.push(nextHref))}
            loading={pending}
          >
            {preview ? 'Continue' : 'Skip for now'}
          </Button>
        </div>
      </div>
    </div>
  )
}
