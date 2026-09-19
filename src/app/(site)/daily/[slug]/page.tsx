import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArticleContent } from '@/components/daily/article-content'
import { ArticleImage } from '@/components/daily/article-image'
import { ArticleMeta } from '@/components/daily/article-meta'
import { getDailyArticle, normalizeKeywords, validCanonicalUrl } from '@/lib/daily'

type ArticlePageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = await getDailyArticle((await params).slug)
  if (!article) return {}

  const description = article.seo_description?.trim() || article.excerpt?.trim() || undefined
  const image = article.featured_image_url?.trim()
  const canonical = validCanonicalUrl(article.canonical_url)

  return {
    title: article.seo_title?.trim() || article.title,
    description,
    keywords: normalizeKeywords(article.seo_keywords),
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: 'article',
      title: article.seo_title?.trim() || article.title,
      description,
      publishedTime: article.published_at ?? undefined,
      authors: article.author ? [article.author.display_name || article.author.username].filter(Boolean) as string[] : undefined,
      images: image ? [{ url: image, alt: article.title }] : undefined,
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await getDailyArticle((await params).slug)
  if (!article) notFound()

  const authorName = article.author?.display_name || article.author?.username

  return (
    <main className="article-page">
      <article>
        <Link href="/daily" className="article-back"><span aria-hidden="true">←</span> Back to Evo Daily</Link>
        <header className="article-header">
          {article.category && <p className="section-kicker">{article.category.name}</p>}
          <h1>{article.title}</h1>
          {article.excerpt && <p className="article-deck">{article.excerpt}</p>}
          <ArticleMeta publishedAt={article.published_at} readTime={article.read_time_minutes} author={authorName} />
        </header>

        {article.featured_image_url ? <ArticleImage src={article.featured_image_url} alt={`${article.title} featured image`} priority className="article-hero-image" /> : null}
        <ArticleContent content={article.content} />

        {article.tags.length > 0 && (
          <footer className="article-tags" aria-label="Article topics">
            <p>Topics</p>
            <ul>{article.tags.map((tag) => <li key={tag.id}>{tag.name}</li>)}</ul>
          </footer>
        )}
      </article>
    </main>
  )
}
