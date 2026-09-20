'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ArticleBookmarkProps = {
  articleId: string
  articlePath: string
  authenticated: boolean
  initiallySaved: boolean
}

export function ArticleBookmark({ articleId, articlePath, authenticated, initiallySaved }: ArticleBookmarkProps) {
  const router = useRouter()
  const pendingRef = useRef(false)
  const [saved, setSaved] = useState(initiallySaved)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function toggleBookmark() {
    if (pendingRef.current) return

    if (!authenticated) {
      router.push(`/auth/login?next=${encodeURIComponent(articlePath)}`)
      return
    }

    pendingRef.current = true
    setPending(true)
    setError('')

    try {
      const response = await fetch('/api/daily/bookmarks', {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
        credentials: 'same-origin',
        cache: 'no-store',
      })

      if (!response.ok) throw new Error('Bookmark mutation failed')
      setSaved((await response.json() as { saved: boolean }).saved)
    } catch {
      setError('Could not update your saved articles. Please try again.')
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const label = saved ? 'SAVED' : 'SAVE'

  return (
    <div className="article-bookmark-wrap">
      <button
        type="button"
        className="article-bookmark"
        onClick={toggleBookmark}
        disabled={pending}
        aria-label={saved ? 'Remove this article from saved articles' : 'Save this article'}
        aria-pressed={saved}
        aria-busy={pending}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'}>
          <path d="M6.75 4.75c0-.69.56-1.25 1.25-1.25h8c.69 0 1.25.56 1.25 1.25v15.1L12 16.45l-5.25 3.4V4.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span>{pending ? 'UPDATING…' : label}</span>
      </button>
      <span className="article-bookmark-status" role="status" aria-live="polite">
        {error}
      </span>
    </div>
  )
}
