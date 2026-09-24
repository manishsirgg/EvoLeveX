import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import type { VaultCategory } from '@/lib/admin-vault'
import { CategoryEditor } from '../../category-editor'

export default async function EditVaultCategoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string }> }) {
  await requireAdmin()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const result = await supabase.from('evo_vault_categories').select('id,name,slug,description,image_url,sort_order,is_active').eq('id', id).maybeSingle()
  if (result.error || !result.data) notFound()
  return <CategoryEditor category={result.data as VaultCategory} saved={query.success === 'saved'} />
}
