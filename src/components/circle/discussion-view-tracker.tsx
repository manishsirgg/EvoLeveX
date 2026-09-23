'use client'

import { useEffect, useRef, useState } from 'react'

function formatViewCount(count: number) {
  return `${count.toLocaleString('en')} ${count === 1 ? 'view' : 'views'}`
}

export function CircleDiscussionViewTracker({ slug, initialCount }: { slug: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true

    void fetch('/api/circle/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((response) => response.ok ? response.json() as Promise<{ viewCount?: unknown }> : null)
      .then((result) => {
        if (result && typeof result.viewCount === 'number' && Number.isSafeInteger(result.viewCount) && result.viewCount >= 0) {
          setCount(result.viewCount)
        }
      })
      .catch(() => {
        // Analytics is best-effort and must never affect discussion readability.
      })
  }, [slug])

  return <span aria-live="polite">{formatViewCount(count)}</span>
}
