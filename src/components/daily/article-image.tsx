'use client'

import { useState } from 'react'

type ArticleImageProps = {
  src: string | null
  alt: string
  className?: string
  priority?: boolean
}

export function ArticleImage({ src, alt, className = '', priority = false }: ArticleImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src?.trim() || failed) {
    return <div className={`article-image-fallback ${className}`} aria-hidden="true"><span>Evo Daily</span></div>
  }

  return (
    // Native images support editorial URLs from multiple trusted publishing sources without a broad Next.js host allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  )
}
