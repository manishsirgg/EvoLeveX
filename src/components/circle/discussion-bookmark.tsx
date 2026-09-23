'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  discussionId: string
  path: string
  authenticated: boolean
  initiallySaved: boolean
}

export function CircleDiscussionBookmark({ discussionId, path, authenticated, initiallySaved }: Props) {
  const router = useRouter()
  const busy = useRef(false)
  const [saved, setSaved] = useState(initiallySaved)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    if (busy.current) return
    if (!authenticated) {
      router.push(`/auth/login?next=${encodeURIComponent(path)}`)
      return
    }

    busy.current = true
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/circle/discussion-bookmarks', {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discussionId }),
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const result = await response.json() as { saved?: unknown }
      if (!response.ok || typeof result.saved !== 'boolean') throw new Error('Bookmark mutation failed')
      setSaved(result.saved)
      router.refresh()
    } catch {
      setError('Could not update your saved discussions. Try again.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return <span className="circle-bookmark-wrap">
    <button
      type="button"
      className="circle-bookmark"
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? 'Remove this discussion from saved discussions' : 'Save this discussion'}
      aria-pressed={saved}
      aria-busy={pending}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'}>
        <path d="M6.75 4.75c0-.69.56-1.25 1.25-1.25h8c.69 0 1.25.56 1.25 1.25v15.1L12 16.45l-5.25 3.4V4.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span>{pending ? 'UPDATING…' : saved ? 'SAVED' : 'SAVE'}</span>
    </button>
    <span className="circle-action-error" role="status" aria-live="polite">{error}</span>
  </span>
}
