import Link from 'next/link'

import type { TvVideoSummary } from '@/lib/tv'
import { formatDuration } from '@/components/tv/video-card'

export function FeaturedVideo({ video }: { video: TvVideoSummary }) {
  const duration = formatDuration(video.durationSeconds)
  return (
    <section className="tv-featured" aria-labelledby="tv-featured-title">
      <div className="tv-featured-visual">
        {/* The source can be an arbitrary editor-provided override, so it is not passed to next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.thumbnailUrl} alt={`Thumbnail for ${video.title}`} />
        <span className="tv-featured-shade" />
      </div>
      <div className="tv-featured-copy">
        <p className="section-index">Featured transmission</p>
        {video.category && <p className="tv-featured-category">{video.category.name}</p>}
        <h2 id="tv-featured-title">{video.title}</h2>
        {video.description && <p>{video.description}</p>}
        <div className="tv-featured-actions">
          <Link className="button button-primary" href={`/tv/${encodeURIComponent(video.slug)}`}>Watch now <span aria-hidden="true">→</span></Link>
          {duration && <span>{duration}</span>}
        </div>
      </div>
    </section>
  )
}
