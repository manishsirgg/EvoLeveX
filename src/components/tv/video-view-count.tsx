'use client'

import { useEffect, useState } from 'react'

import { VIEW_COUNT_EVENT } from './video-player'

type ViewCountDetail = { slug?: unknown; viewCount?: unknown }

function formatViewCount(count: number) {
  return `${count.toLocaleString('en')} ${count === 1 ? 'view' : 'views'}`
}

export function VideoViewCount({ slug, initialCount }: { slug: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    function updateCount(event: Event) {
      const detail = (event as CustomEvent<ViewCountDetail>).detail
      if (detail?.slug === slug && typeof detail.viewCount === 'number' && Number.isSafeInteger(detail.viewCount) && detail.viewCount >= 0) {
        setCount(detail.viewCount)
      }
    }

    window.addEventListener(VIEW_COUNT_EVENT, updateCount)
    return () => window.removeEventListener(VIEW_COUNT_EVENT, updateCount)
  }, [slug])

  return <span className="tv-view-count" aria-live="polite">{formatViewCount(count)}</span>
}
