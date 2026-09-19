import Link from 'next/link'

import type { DailyArticleSummary } from '@/lib/daily'
import { ArticleImage } from './article-image'
import { ArticleMeta } from './article-meta'

export function ArticleCard({ article }: { article: DailyArticleSummary }) {
  return (
    <article className="article-card">
      <Link href={`/daily/${encodeURIComponent(article.slug)}`} aria-label={`Read ${article.title}`} className="article-card-image">
        <ArticleImage src={article.featured_image_url} alt={`${article.title} featured image`} />
      </Link>
      <div className="article-card-body">
        {article.category && <p className="article-category">{article.category.name}</p>}
        <h3><Link href={`/daily/${encodeURIComponent(article.slug)}`}>{article.title}</Link></h3>
        {article.excerpt && <p className="article-card-excerpt">{article.excerpt}</p>}
        <ArticleMeta publishedAt={article.published_at} readTime={article.read_time_minutes} />
      </div>
    </article>
  )
}
