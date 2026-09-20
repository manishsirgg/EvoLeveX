export function VideoPlayer({ youtubeVideoId, title }: { youtubeVideoId: string; title: string }) {
  return <div className="tv-player">
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeVideoId)}`}
      title={`${title} — Evo TV video player`}
      loading="lazy"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  </div>
}
