import { requireAdmin } from '@/lib/admin-auth'
import { getEditorOptions } from '@/lib/admin-daily-editor'
import { ArticleEditor } from '../article-editor'

export default async function NewArticlePage() {
  await requireAdmin()
  const { categories, tags, hasError } = await getEditorOptions()
  return <ArticleEditor article={null} categories={categories} tags={tags} optionsError={hasError} warning={hasError ? 'Some categories or tags could not be loaded. Refresh before publishing.' : undefined} />
}
