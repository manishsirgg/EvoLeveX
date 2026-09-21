'use client'

import { useEffect, useRef } from 'react'

type YouTubePlayer = { destroy: () => void }
type YouTubePlayerEvent = { data: number }
type YouTubeNamespace = {
  Player: new (element: HTMLIFrameElement, options: {
    events: { onStateChange: (event: YouTubePlayerEvent) => void }
  }) => YouTubePlayer
  PlayerState: { PLAYING: number }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const VIEW_COUNT_EVENT = 'evo-tv-view-count'
let apiPromise: Promise<YouTubeNamespace> | null = null

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('YouTube IFrame API did not initialize'))
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    if (existingScript) {
      existingScript.addEventListener('error', () => reject(new Error('Unable to load YouTube IFrame API')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.addEventListener('error', () => reject(new Error('Unable to load YouTube IFrame API')), { once: true })
    document.head.appendChild(script)
  })

  return apiPromise
}

async function recordView(slug: string) {
  const response = await fetch('/api/tv/views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) return

  const result = await response.json() as { viewCount?: unknown }
  if (typeof result.viewCount === 'number' && Number.isSafeInteger(result.viewCount) && result.viewCount >= 0) {
    window.dispatchEvent(new CustomEvent(VIEW_COUNT_EVENT, { detail: { slug, viewCount: result.viewCount } }))
  }
}

export function VideoPlayer({ youtubeVideoId, title, slug }: { youtubeVideoId: string; title: string; slug: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const requested = useRef(false)

  useEffect(() => {
    let cancelled = false
    let player: YouTubePlayer | null = null

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !iframeRef.current) return
      player = new YT.Player(iframeRef.current, {
        events: {
          onStateChange(event) {
            if (event.data !== YT.PlayerState.PLAYING || requested.current) return
            requested.current = true
            void recordView(slug).catch(() => {
              // View analytics is best-effort and must never affect playback.
            })
          },
        },
      })
    }).catch(() => {
      // The iframe remains independently usable if the tracking API cannot load.
    })

    return () => {
      cancelled = true
      player?.destroy()
    }
  }, [slug])

  return <div className="tv-player">
    <iframe
      ref={iframeRef}
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeVideoId)}?enablejsapi=1`}
      title={`${title} — Evo TV video player`}
      loading="lazy"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  </div>
}

export { VIEW_COUNT_EVENT }
