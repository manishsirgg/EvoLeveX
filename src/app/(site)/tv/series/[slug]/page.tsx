import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VideoCard } from '@/components/tv/video-card'
import { getTvSeriesPageData } from '@/lib/tv'

type TvSeriesPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

const genericDescription = 'Watch this Evo TV series for practical ideas on performance, strategy and purposeful living.'

function parsePage(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1
}

function canonicalUrl(slug: string) {
  return `https://evolevex.com/tv/series/${encodeURIComponent(slug)}`
}

function pageHref(slug: string, page: number) {
  const base = `/tv/series/${encodeURIComponent(slug)}`
  return page > 1 ? `${base}?page=${page}` : base
}

export async function generateMetadata({ params }: TvSeriesPageProps): Promise<Metadata> {
  const data = await getTvSeriesPageData((await params).slug, 1)
  if (!data) return {}

  const title = `${data.series.title} | Evo TV`
  const socialTitle = `${data.series.title} | Evo TV | EvoLeveX`
  const description = data.series.description?.trim() || genericDescription
  const canonical = canonicalUrl(data.series.slug)
  const images = data.series.thumbnailUrl ? [{ url: data.series.thumbnailUrl, alt: data.series.title }] : undefined

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title: socialTitle, description, url: canonical, images },
    twitter: { card: 'summary_large_image', title: socialTitle, description, images: data.series.thumbnailUrl ? [data.series.thumbnailUrl] : undefined },
  }
}

export default async function TvSeriesPage({ params, searchParams }: TvSeriesPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const page = parsePage(query.page)
  const data = await getTvSeriesPageData(slug, page)
  if (!data) notFound()

  const description = data.series.description?.trim()
  const beyondResults = page > 1 && data.videos.length === 0

  return <main className="tv-page tv-series-page">
    <Link className="tv-back-link" href="/tv">← Back to Evo TV</Link>

    <header className={`tv-series-hero${data.series.thumbnailUrl ? ' tv-series-hero-with-image' : ''}`}>
      <div className="tv-series-hero-copy">
        <p className="section-kicker">Evo TV Series</p>
        <h1>{data.series.title}</h1>
        {description && <p>{description}</p>}
      </div>
      {data.series.thumbnailUrl && <div className="tv-series-hero-image">
        {/* Series artwork may be hosted outside the configured Next Image origins. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.series.thumbnailUrl} alt={`${data.series.title} series artwork`} />
      </div>}
    </header>

    <section className="tv-series-videos" aria-labelledby="series-videos-heading">
      <div className="tv-section-heading">
        <div><p className="section-index">Series library</p><h2 id="series-videos-heading">Watch the series</h2></div>
        {data.videos.length > 0 && <p>{data.videos.length} video{data.videos.length === 1 ? '' : 's'} on page {page}</p>}
      </div>

      {beyondResults ? (
        <div className="tv-empty"><span>End of series</span><h3>There are no videos on this page.</h3><p>Return to the beginning to watch this series.</p><Link className="button button-secondary" href={pageHref(data.series.slug, 1)}>Back to page one</Link></div>
      ) : data.videos.length === 0 ? (
        <div className="tv-empty"><span>Coming into focus</span><h3>More from this series is being prepared.</h3><p>Explore Evo TV while the next installment takes shape.</p><Link className="button button-secondary" href="/tv">Explore Evo TV</Link></div>
      ) : <div className="tv-video-grid">{data.videos.map((video) => <VideoCard video={video} key={video.id} />)}</div>}

      {!beyondResults && (page > 1 || data.hasNextPage) && <nav className="tv-pagination" aria-label={`${data.series.title} video pages`}>
        <div>{page > 1 && <Link href={pageHref(data.series.slug, page - 1)} rel="prev">← Previous</Link>}</div>
        <p>Page <strong>{page}</strong></p>
        <div>{data.hasNextPage && <Link href={pageHref(data.series.slug, page + 1)} rel="next">Next →</Link>}</div>
      </nav>}
    </section>
  </main>
}
