type ArticleMetaProps = {
  publishedAt: string | null
  readTime: number | null
  author?: string | null
}

export function formatPublishedDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function ArticleMeta({ publishedAt, readTime, author }: ArticleMetaProps) {
  const date = formatPublishedDate(publishedAt)
  if (!date && !readTime && !author) return null

  return (
    <div className="article-meta">
      {author && <span>By {author}</span>}
      {date && <time dateTime={publishedAt ?? undefined}>{date}</time>}
      {readTime && readTime > 0 && <span>{readTime} min read</span>}
    </div>
  )
}
