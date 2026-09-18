import type { Metadata } from 'next'

import { ArticleCard } from '@/components/daily/article-card'
import { CategoryNavigation } from '@/components/daily/category-navigation'
import { DailyEmptyState } from '@/components/daily/daily-empty-state'
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

type DailyPageProps = {
  searchParams: Promise<{ category?: string | string[] }>
}

export default async function DailyPage({ searchParams }: DailyPageProps) {
  const requestedCategory = (await searchParams).category
  const categorySlug = typeof requestedCategory === 'string' ? requestedCategory : undefined
  const { articles, categories, hasError } = await getDailyLandingData(categorySlug)
  const activeCategory = categories.find((category) => category.slug === categorySlug)
  const featuredArticle = articles.find((article) => article.is_featured)

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
          {articles.length > 0 && <p>{articles.length} {articles.length === 1 ? 'article' : 'articles'}</p>}
        </div>

        {hasError ? (
          <div className="daily-notice" role="status">
            <p>THE JOURNAL IS TEMPORARILY UNAVAILABLE</p>
            <h2>We&apos;re restoring the signal.</h2>
            <span>Please return shortly to continue reading Evo Daily.</span>
          </div>
        ) : articles.length === 0 ? (
          <DailyEmptyState filtered={Boolean(activeCategory)} />
        ) : (
          <div className="article-grid">
            {articles.map((article) => <ArticleCard article={article} key={article.id} />)}
          </div>
        )}
      </section>
    </main>
  )
}
