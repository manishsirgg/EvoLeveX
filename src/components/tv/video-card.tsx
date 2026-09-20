import Link from 'next/link'

import type { TvVideoSummary } from '@/lib/tv'

export function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function VideoCard({ video }: { video: TvVideoSummary }) {
  const duration = formatDuration(video.durationSeconds)
  return (
    <article className="tv-video-card">
      <Link className="tv-video-card-link" href={`/tv/${encodeURIComponent(video.slug)}`} aria-label={`Watch ${video.title}`}>
        <span className="tv-thumbnail">
          {/* Remote overrides and YouTube thumbnails intentionally use the native responsive element. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="" loading="lazy" />
          {duration && <span className="tv-duration">{duration}</span>}
        </span>
        <span className="tv-card-copy">
          <span className="tv-card-labels">
            {video.category && <span>{video.category.name}</span>}
            {video.series && <span>{video.series.title}</span>}
          </span>
          <h3>{video.title}</h3>
          {video.description && <span className="tv-card-description">{video.description}</span>}
          {video.publishedAt && <time dateTime={video.publishedAt}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(video.publishedAt))}</time>}
        </span>
      </Link>
    </article>
  )
}
