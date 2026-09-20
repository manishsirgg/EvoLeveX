import type { Metadata } from 'next'
import Link from 'next/link'

import { FeaturedVideo } from '@/components/tv/featured-video'
import { SeriesCard } from '@/components/tv/series-card'
import { VideoCard } from '@/components/tv/video-card'
import { getTvLandingData } from '@/lib/tv'

const description = "EvoLeveX's video library for men's performance, strategy, psychology, relationships, discipline, wealth, social dynamics and purposeful living."

export const metadata: Metadata = {
  title: 'Evo TV',
  description,
  alternates: { canonical: 'https://evolevex.com/tv' },
  openGraph: { title: 'Evo TV | EvoLeveX', description, type: 'website', url: 'https://evolevex.com/tv' },
  twitter: { card: 'summary_large_image', title: 'Evo TV | EvoLeveX', description },
}

type TvPageProps = { searchParams: Promise<{ category?: string | string[]; page?: string | string[] }> }

function parsePage(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1
}

function pageHref(page: number, category?: string) {
  const query = new URLSearchParams()
  if (category) query.set('category', category)
  if (page > 1) query.set('page', String(page))
  const value = query.toString()
  return value ? `/tv?${value}` : '/tv'
}

export default async function TvPage({ searchParams }: TvPageProps) {
  const query = await searchParams
  const requestedCategory = typeof query.category === 'string' ? query.category : undefined
  const page = parsePage(query.page)
  const data = await getTvLandingData(requestedCategory, page)
  const beyondResults = !data.hasError && page > 1 && data.videos.length === 0

  return (
    <main className="tv-page">
      <header className="tv-intro">
        <p className="section-kicker">Evo TV</p>
        <h1>Watch. Learn.<br /><em>Evolve.</em></h1>
        <p>Sharp ideas, practical strategy and uncompromising conversations for men committed to becoming more.</p>
      </header>

      {!data.hasError && data.featuredVideo && <FeaturedVideo video={data.featuredVideo} />}

      <nav className="tv-categories" aria-label="Evo TV categories">
        <div>
          <Link className={!data.activeCategory ? 'active' : undefined} href="/tv">All</Link>
          {data.categories.map((category) => (
            <Link className={data.activeCategory?.id === category.id ? 'active' : undefined} href={`/tv?category=${encodeURIComponent(category.slug)}`} key={category.id}>{category.name}</Link>
          ))}
        </div>
      </nav>

      <section className="tv-latest" aria-labelledby="tv-latest-heading">
        <div className="tv-section-heading">
          <div><p className="section-index">Latest videos</p><h2 id="tv-latest-heading">{data.activeCategory?.name ?? 'The latest signal'}</h2></div>
          {!data.hasError && (data.videos.length > 0 || page > 1) && <p>Page {page}</p>}
        </div>

        {data.hasError ? (
          <div className="tv-empty" role="status"><span>Signal interrupted</span><h3>Unable to load Evo TV right now.</h3><p>Please return shortly while we restore the connection.</p></div>
        ) : beyondResults ? (
          <div className="tv-empty"><span>End of transmission</span><h3>There are no videos on this page.</h3><p>Return to the beginning to continue exploring Evo TV.</p><Link className="button button-secondary" href={pageHref(1, data.activeCategory?.slug)}>Back to page one</Link></div>
        ) : data.videos.length === 0 ? (
          <div className="tv-empty"><span>Coming into focus</span><h3>{data.activeCategory ? 'No videos are available in this category.' : data.featuredVideo ? 'More Evo TV is being prepared.' : 'Evo TV is being prepared.'}</h3><p>{data.activeCategory ? 'Explore all videos or check back soon.' : 'New films, conversations and field-tested ideas are on the way.'}</p>{data.activeCategory && <Link className="button button-secondary" href="/tv">Explore all videos</Link>}</div>
        ) : <div className="tv-video-grid">{data.videos.map((video) => <VideoCard video={video} key={video.id} />)}</div>}

        {!data.hasError && !beyondResults && (page > 1 || data.hasNextPage) && (
          <nav className="tv-pagination" aria-label="Video pages">
            <div>{page > 1 && <Link rel="prev" href={pageHref(page - 1, data.activeCategory?.slug)}>← Previous</Link>}</div>
            <p>Page <strong>{page}</strong></p>
            <div>{data.hasNextPage && <Link rel="next" href={pageHref(page + 1, data.activeCategory?.slug)}>Next →</Link>}</div>
          </nav>
        )}
      </section>

      {!data.hasError && data.series.length > 0 && (
        <section className="tv-series" aria-labelledby="tv-series-heading">
          <div className="tv-section-heading"><div><p className="section-index">Curated collections</p><h2 id="tv-series-heading">Explore the series</h2></div></div>
          <div className="tv-series-grid">{data.series.map((series) => <SeriesCard series={series} key={series.id} />)}</div>
        </section>
      )}
    </main>
  )
}
