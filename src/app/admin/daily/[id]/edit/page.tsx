import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { getEditorArticle, getEditorOptions } from '@/lib/admin-daily-editor'
import { ArticleEditor } from '../../article-editor'

export default async function EditArticlePage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; warning?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const article = await getEditorArticle(id)
  if (!article) notFound()
  const [{ success, warning }, options] = await Promise.all([searchParams, getEditorOptions(article.category_id)])
  return <ArticleEditor article={article} categories={options.categories} tags={options.tags} optionsError={options.hasError} feedback={success} warning={warning ?? (options.hasError ? 'Some categories or tags could not be loaded. Refresh before saving.' : undefined)} />
}
