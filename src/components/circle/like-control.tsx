'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { id: string; path: string; authenticated: boolean; initiallyLiked: boolean; initialCount: number; kind: 'discussion' | 'reply' }

export function CircleLikeControl({ id, path, authenticated, initiallyLiked, initialCount, kind }: Props) {
  const router = useRouter()
  const busy = useRef(false)
  const [liked, setLiked] = useState(initiallyLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function toggle() {
    if (busy.current) return
    if (!authenticated) { router.push(`/auth/login?next=${encodeURIComponent(path)}`); return }
    busy.current = true; setPending(true); setError('')
    try {
      const key = kind === 'discussion' ? 'discussionId' : 'replyId'
      const response = await fetch(`/api/circle/${kind}-likes`, { method: liked ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: id }), credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('Mutation failed')
      const result = await response.json() as { liked?: unknown; likeCount?: unknown }
      if (typeof result.liked !== 'boolean' || !Number.isSafeInteger(result.likeCount) || Number(result.likeCount) < 0) throw new Error('Invalid response')
      setLiked(result.liked); setCount(Number(result.likeCount))
    } catch { setError('Could not update your like. Try again.') } finally { busy.current = false; setPending(false) }
  }
  return <span className="circle-like-wrap">
    <button type="button" className="circle-like" onClick={toggle} disabled={pending} aria-pressed={liked} aria-busy={pending} aria-label={`${liked ? 'Unlike' : 'Like'} this ${kind}. ${count} ${count === 1 ? 'like' : 'likes'}.`}>
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {pending ? 'Updating…' : liked ? 'Liked' : 'Like'} · {count}
    </button>
    <span className="circle-action-error" role="status" aria-live="polite">{error}</span>
  </span>
}
