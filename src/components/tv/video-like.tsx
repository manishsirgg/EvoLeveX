'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type VideoLikeProps = {
  videoId: string
  videoPath: string
  authenticated: boolean
  initiallyLiked: boolean
  initialLikeCount: number
}

type LikeResponse = { liked: boolean; likeCount: number }

export function VideoLike({ videoId, videoPath, authenticated, initiallyLiked, initialLikeCount }: VideoLikeProps) {
  const router = useRouter()
  const pendingRef = useRef(false)
  const [liked, setLiked] = useState(initiallyLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function toggleLike() {
    if (pendingRef.current) return

    if (!authenticated) {
      router.push(`/auth/login?next=${encodeURIComponent(videoPath)}`)
      return
    }

    pendingRef.current = true
    setPending(true)
    setError('')

    try {
      const response = await fetch('/api/tv/likes', {
        method: liked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Like mutation failed')

      const result = await response.json() as LikeResponse
      if (typeof result.liked !== 'boolean' || !Number.isSafeInteger(result.likeCount) || result.likeCount < 0) {
        throw new Error('Invalid like response')
      }

      setLiked(result.liked)
      setLikeCount(result.likeCount)
    } catch {
      setError('Could not update your like. Please try again.')
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <div className="tv-bookmark-wrap">
      <button
        type="button"
        className="tv-bookmark tv-like"
        onClick={toggleLike}
        disabled={pending}
        aria-label={`${liked ? 'Unlike' : 'Like'} this video. ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}.`}
        aria-pressed={liked}
        aria-busy={pending}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span>{pending ? 'UPDATING…' : liked ? 'LIKED' : 'LIKE'} <span aria-hidden="true">·</span> {likeCount}</span>
      </button>
      <span className="tv-bookmark-status" role="status" aria-live="polite">{error}</span>
    </div>
  )
}
