import { notFound } from 'next/navigation'
import { MagazineArticle } from '@/components/daily/magazine-article'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminPreviewArticle } from '@/lib/admin-daily-editor'
import { getArticleBlocks, getBlockResources } from '@/lib/daily-block-data'

export default async function AdminDailyPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const article = await getAdminPreviewArticle(id)
  if (!article) notFound()
  const { blocks } = await getArticleBlocks(id)
  return <MagazineArticle article={article} blocks={blocks} resources={await getBlockResources(blocks)} preview />
}
