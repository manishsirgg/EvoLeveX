import type { Metadata } from 'next'

import { ArticleCard } from '@/components/daily/article-card'
import { CategoryNavigation } from '@/components/daily/category-navigation'
import { DailyEmptyState } from '@/components/daily/daily-empty-state'
import { DailyPagination } from '@/components/daily/daily-pagination'
import { FeaturedArticle } from '@/components/daily/featured-article'
import { getDailyLandingData } from '@/lib/daily'

export const metadata: Metadata = {
  title: 'Evo Daily',
  description: 'Daily intelligence, strategy and practical insights for men committed to progress.',
  openGraph: {
    title: 'Evo Daily | EvoLeveX',
    description: 'Daily intelligence, strategy and practical insights for men committed to progress.',
    type: 'website',
  },
}

type DailyPageProps = { searchParams: Promise<{ category?: string | string[], page?: string | string[] }> }

function parsePage(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1
}

export default async function DailyPage({ searchParams }: DailyPageProps) {
  const query = await searchParams
  const requestedCategory = query.category
  const categorySlug = typeof requestedCategory === 'string' ? requestedCategory : undefined
  const page = parsePage(query.page)
  const { activeCategory, articles, categories, featuredArticle, hasError, hasNextPage } = await getDailyLandingData(categorySlug, page)

  return (
    <main className="daily-page">
      <header className="daily-hero">
        <p className="section-kicker">Intelligence / Every day</p>
        <h1>Evo Daily</h1>
        <p>Clear thinking for the work of becoming more. Practical perspectives on performance, relationships, wealth and life strategy.</p>
      </header>

      <CategoryNavigation categories={categories} activeSlug={activeCategory?.slug} />

      {featuredArticle && <FeaturedArticle article={featuredArticle} />}

      <section className="daily-latest" aria-labelledby="latest-heading">
        <div className="daily-section-heading">
          <div>
            <p className="section-index">The journal</p>
            <h2 id="latest-heading">{activeCategory ? activeCategory.name : 'Latest intelligence'}</h2>
          </div>
          {(articles.length > 0 || page > 1) && <p>Page {page} / {articles.length} {articles.length === 1 ? 'article' : 'articles'}</p>}
        </div>

        {hasError ? (
          <div className="daily-notice" role="status">
            <p>THE JOURNAL IS TEMPORARILY UNAVAILABLE</p>
            <h2>We&apos;re restoring the signal.</h2>
            <span>Please return shortly to continue reading Evo Daily.</span>
          </div>
        ) : articles.length === 0 ? (
          <DailyEmptyState categorySlug={activeCategory?.slug} filtered={Boolean(activeCategory)} page={page} featuredOnly={Boolean(featuredArticle)} />
        ) : (
          <div className="article-grid">
            {articles.map((article) => <ArticleCard article={article} key={article.id} />)}
          </div>
        )}
        {!hasError && <DailyPagination categorySlug={activeCategory?.slug} hasNextPage={hasNextPage} page={page} />}
      </section>
    </main>
  )
}
