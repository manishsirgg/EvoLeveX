import { VideoCard } from '@/components/tv/video-card'
import type { TvVideoSummary } from '@/lib/tv'

export function RelatedVideos({ videos }: { videos: TvVideoSummary[] }) {
  if (!videos.length) return null
  return <section className="tv-related" aria-labelledby="tv-related-heading">
    <div className="tv-section-heading"><div><p className="section-index">Keep watching</p><h2 id="tv-related-heading">Related videos</h2></div></div>
    <div className="tv-video-grid">{videos.map((video) => <VideoCard video={video} key={video.id} />)}</div>
  </section>
}
