'use client'

import { useEffect, useRef, useState } from 'react'

import { formatViewCount } from './article-meta'

export function ArticleViewTracker({ slug, initialCount }: { slug: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true

    void fetch('/api/daily/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((response) => response.ok ? response.json() as Promise<{ count?: unknown }> : null)
      .then((result) => {
        if (result && typeof result.count === 'number' && Number.isSafeInteger(result.count) && result.count >= 0) {
          setCount(result.count)
        }
      })
      .catch(() => {
        // Analytics is best-effort and must never affect article readability.
      })
  }, [slug])

  return <span aria-live="polite">{formatViewCount(count)}</span>
}
