import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RelatedVideos } from '@/components/tv/related-videos'
import { VideoPlayer } from '@/components/tv/video-player'
import { VideoShare } from '@/components/tv/video-share'
import { formatDuration } from '@/components/tv/video-card'
import { getPublicTvVideo, getRelatedTvVideos } from '@/lib/tv'

type TvVideoPageProps = { params: Promise<{ slug: string }> }

const genericDescription = 'Watch Evo TV for practical ideas on performance, strategy, relationships, discipline and purposeful living.'

function canonicalUrl(slug: string) {
  return `https://evolevex.com/tv/${encodeURIComponent(slug)}`
}

export async function generateMetadata({ params }: TvVideoPageProps): Promise<Metadata> {
  const video = await getPublicTvVideo((await params).slug)
  if (!video) return {}

  const title = video.seoTitle?.trim() || video.title
  const description = video.seoDescription?.trim() || video.description?.trim() || genericDescription
  const canonical = canonicalUrl(video.slug)
  const image = video.thumbnailUrl
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical, images: [{ url: image, alt: video.title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function TvVideoPage({ params }: TvVideoPageProps) {
  const video = await getPublicTvVideo((await params).slug)
  if (!video) notFound()

  const relatedVideos = await getRelatedTvVideos(video)
  const duration = formatDuration(video.durationSeconds)
  const description = video.description?.trim()
  const canonical = canonicalUrl(video.slug)

  return <main className="tv-page tv-detail-page">
    <article className="tv-detail">
      <Link className="tv-back-link" href="/tv">← Back to Evo TV</Link>
      <header className="tv-detail-header">
        <div className="tv-detail-labels">
          <span>Evo TV</span>
          {video.category && <Link href={`/tv?category=${encodeURIComponent(video.category.slug)}`}>{video.category.name}</Link>}
        </div>
        <h1>{video.title}</h1>
        {(video.publishedAt || duration || video.series) && <div className="tv-detail-meta">
          {video.publishedAt && <time dateTime={video.publishedAt}>{new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(video.publishedAt))}</time>}
          {duration && <span>{duration}</span>}
          {/* The public series route arrives in Step 3; avoid shipping a knowingly broken link. */}
          {video.series && <span>Series: {video.series.title}</span>}
        </div>}
      </header>

      <VideoPlayer youtubeVideoId={video.youtubeVideoId} title={video.title} />

      <div className="tv-detail-body">
        {description && <section className="tv-description" aria-labelledby="tv-description-heading">
          <h2 id="tv-description-heading">About this video</h2>
          <p>{description}</p>
        </section>}
        <div className="tv-share-row"><p>Share the signal</p><VideoShare title={video.title} description={video.description} url={canonical} /></div>
      </div>
    </article>
    <RelatedVideos videos={relatedVideos} />
  </main>
}
