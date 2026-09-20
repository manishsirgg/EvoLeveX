import type { DailyArticleSummary } from '@/lib/daily'
import { ArticleCard } from './article-card'

export function RelatedArticles({ articles }: { articles: DailyArticleSummary[] }) {
  if (!articles.length) return null

  return (
    <section className="related-articles" aria-labelledby="related-articles-heading">
      <div className="related-articles-heading">
        <p className="section-index">Continue your evolution</p>
        <h2 id="related-articles-heading">Related Articles</h2>
      </div>
      <div className="article-grid">
        {articles.map((article) => <ArticleCard article={article} key={article.id} />)}
      </div>
    </section>
  )
}
