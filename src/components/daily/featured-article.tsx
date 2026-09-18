import Link from 'next/link'

import type { DailyArticleSummary } from '@/lib/daily'
import { ArticleImage } from './article-image'
import { ArticleMeta } from './article-meta'

export function FeaturedArticle({ article }: { article: DailyArticleSummary }) {
  return (
    <section className="daily-featured" aria-labelledby="featured-title">
      <Link href={`/daily/${encodeURIComponent(article.slug)}`} className="featured-image" aria-label={`Read ${article.title}`}>
        <ArticleImage src={article.featured_image_url} alt="" priority />
      </Link>
      <div className="featured-copy">
        <p className="section-index">Featured {article.category ? `/ ${article.category.name}` : ''}</p>
        <h2 id="featured-title"><Link href={`/daily/${encodeURIComponent(article.slug)}`}>{article.title}</Link></h2>
        {article.excerpt && <p>{article.excerpt}</p>}
        <ArticleMeta publishedAt={article.published_at} readTime={article.read_time_minutes} />
        <Link href={`/daily/${encodeURIComponent(article.slug)}`} className="text-link">Read the article <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  )
}
