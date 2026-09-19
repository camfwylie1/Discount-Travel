'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'

export function UnblockButton({ userId }: { userId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/social/block', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        setBusy(false)
        router.refresh()
      }}
    >
      Unblock
    </Button>
  )
}
