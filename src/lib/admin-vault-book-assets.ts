import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type AdminVaultBookAsset = {
  id: string
  title: string
  filename: string
  fileSize: number
  sortOrder: number
  isPrimary: boolean
  isActive: boolean
}

function safeFilename(path: string) {
  const value = path.split('/').at(-1) ?? 'book.pdf'
  return /^[0-9a-f-]+\.pdf$/i.test(value) ? value : 'book.pdf'
}

export async function getAdminVaultBookAssets(productId: string) {
  const service = createServiceRoleClient()
  const result = await service
    .from('evo_vault_book_assets')
    .select('id,title,file_path,file_size,sort_order,is_primary,is_active')
    .eq('vault_product_id', productId)
    .order('is_active', { ascending: false })
    .order('sort_order')
    .order('created_at')
    .order('id')

  if (result.error) return { assets: [] as AdminVaultBookAsset[], hasError: true }
  return {
    assets: (result.data ?? []).map(asset => ({
      id: asset.id,
      title: asset.title,
      filename: safeFilename(asset.file_path),
      fileSize: Number(asset.file_size),
      sortOrder: asset.sort_order,
      isPrimary: asset.is_primary,
      isActive: asset.is_active,
    })),
    hasError: false,
  }
}
