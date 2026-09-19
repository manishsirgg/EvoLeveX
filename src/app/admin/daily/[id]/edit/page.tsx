import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { getBlockComposerData, getEditorArticle, getEditorOptions } from '@/lib/admin-daily-editor'
import { ArticleEditor } from '../../article-editor'
import { MagazineBlockComposer } from '../../magazine-block-composer'

export default async function EditArticlePage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; warning?: string; blockError?: string; blockSuccess?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const article = await getEditorArticle(id)
  if (!article) notFound()
  const [{ success, warning, blockError, blockSuccess }, options, composer] = await Promise.all([searchParams, getEditorOptions(article.category_id), getBlockComposerData(id)])
  return <><ArticleEditor article={article} categories={options.categories} tags={options.tags} optionsError={options.hasError} feedback={success} warning={warning ?? (options.hasError ? 'Some categories or tags could not be loaded. Refresh before saving.' : undefined)} /><MagazineBlockComposer articleId={id} content={article.content} data={composer} error={blockError} success={blockSuccess} /></>
}
