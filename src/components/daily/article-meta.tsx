type ArticleMetaProps = {
  publishedAt: string | null
  readTime: number | null
  author?: string | null
  views?: React.ReactNode
}

export function formatPublishedDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function formatViewCount(count: number) {
  const formatted = count >= 1_000
    ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count)
    : new Intl.NumberFormat('en').format(count)
  return `${formatted} ${count === 1 ? 'view' : 'views'}`
}

export function ArticleMeta({ publishedAt, readTime, author, views }: ArticleMetaProps) {
  const date = formatPublishedDate(publishedAt)
  if (!date && !readTime && !author && !views) return null

  return (
    <div className="article-meta">
      {author && <span>By {author}</span>}
      {date && <time dateTime={publishedAt ?? undefined}>{date}</time>}
      {readTime && readTime > 0 && <span>{readTime} min read</span>}
      {views}
    </div>
  )
}
