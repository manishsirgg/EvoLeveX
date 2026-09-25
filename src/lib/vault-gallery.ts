import { createClient } from '@/lib/supabase/server'

export type VaultProductImage = {
  id: string
  vault_product_id: string
  storage_bucket: string
  storage_path: string
  public_url: string
  alt_text: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

const galleryFields = 'id,vault_product_id,storage_bucket,storage_path,public_url,alt_text,sort_order,created_at,updated_at'

/** Loads a Vault gallery in its stable display order for admin and future public product views. */
export async function getVaultProductImages(vaultProductId: string) {
  const supabase = await createClient()
  const result = await supabase
    .from('evo_vault_product_images')
    .select(galleryFields)
    .eq('vault_product_id', vaultProductId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  return {
    images: (result.data ?? []) as VaultProductImage[],
    hasError: Boolean(result.error),
  }
}
