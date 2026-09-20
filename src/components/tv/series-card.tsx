import Link from 'next/link'

import type { TvSeriesSummary } from '@/lib/tv'

export function SeriesCard({ series }: { series: TvSeriesSummary }) {
  return (
    <article className="tv-series-card">
      <Link href={`/tv/series/${encodeURIComponent(series.slug)}`} aria-label={`Explore ${series.title}`}>
        <span className="tv-series-image">
          {series.thumbnailUrl ? (
            // Remote series overrides intentionally use the native responsive element.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={series.thumbnailUrl} alt="" loading="lazy" />
          ) : <span>Evo TV / Series</span>}
        </span>
        <span className="tv-series-copy">
          <span className="section-index">Series</span>
          <h3>{series.title}</h3>
          {series.description && <span>{series.description}</span>}
          <strong>Explore series <span aria-hidden="true">→</span></strong>
        </span>
      </Link>
    </article>
  )
}
