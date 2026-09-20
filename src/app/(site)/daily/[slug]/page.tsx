import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MagazineArticle } from '@/components/daily/magazine-article'
import { getArticleBlocks, getBlockResources } from '@/lib/daily-block-data'
import { getDailyArticle, normalizeKeywords, validCanonicalUrl } from '@/lib/daily'
import { createClient } from '@/lib/supabase/server'

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

  const [{ blocks }, viewCountResult] = await Promise.all([
    getArticleBlocks(article.id),
    createClient().then((supabase) => supabase.rpc('get_evo_daily_article_view_count', { article_uuid: article.id })),
  ])
  const rawViewCount = Number(viewCountResult.data ?? 0)
  const viewCount = viewCountResult.error || !Number.isSafeInteger(rawViewCount) || rawViewCount < 0 ? 0 : rawViewCount

  return <MagazineArticle article={article} blocks={blocks} resources={await getBlockResources(blocks)} viewCount={viewCount} />
}
