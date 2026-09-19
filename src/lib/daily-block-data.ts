import 'server-only'
import { DailyBlock, DailyBlockResources, EvoTvVideo, StoreProduct, VaultProduct } from '@/lib/daily-blocks'
import { createClient } from '@/lib/supabase/server'

const fields = 'id, article_id, block_type, position_after_paragraph, sort_order, heading, body, image_url, image_alt, caption, evo_tv_video_id, vault_product_id, store_product_id, external_url, button_label, affiliate_disclosure, metadata, is_active, created_at'

type SupabaseError = { code?: string; message?: string; details?: string; hint?: string }

function logBlockQueryError(articleId: string, includeInactive: boolean, error: SupabaseError) {
  // Keep PostgREST diagnostics in server logs; callers receive only the error state.
  console.error('Failed to select evo_daily_article_blocks', {
    articleId,
    includeInactive,
    query: `select ${fields}; article_id = ${articleId}${includeInactive ? '' : '; is_active = true'}; order by position_after_paragraph, sort_order, created_at`,
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  })
}

export async function getArticleBlocks(articleId: string, includeInactive = false) {
  const supabase = await createClient()
  let query = supabase.from('evo_daily_article_blocks').select(fields).eq('article_id', articleId).order('position_after_paragraph').order('sort_order').order('created_at')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) logBlockQueryError(articleId, includeInactive, error)
  return { blocks: error ? [] : (data ?? []) as unknown as DailyBlock[], error }
}

export async function getBlockResources(blocks: DailyBlock[]): Promise<DailyBlockResources> {
  const supabase = await createClient()
  const ids = (key: 'evo_tv_video_id' | 'vault_product_id' | 'store_product_id') => [...new Set(blocks.map((b) => b[key]).filter(Boolean) as string[])]
  const videoIds = ids('evo_tv_video_id'), vaultIds = ids('vault_product_id'), storeIds = ids('store_product_id')
  const [videos, vault, store] = await Promise.all([
    videoIds.length ? supabase.from('evo_tv_videos').select('id, youtube_video_id, title, description, thumbnail_url, duration_seconds, slug, active, published_at').in('id', videoIds).eq('active', true) : Promise.resolve({ data: [] }),
    vaultIds.length ? supabase.from('evo_vault_products').select('id, kind, name, slug, short_description, description, price, currency, cover_image_url, is_active').in('id', vaultIds).eq('is_active', true) : Promise.resolve({ data: [] }),
    storeIds.length ? supabase.from('evo_store_products').select('id, name, slug, short_description, base_price, currency, cover_image_url, is_active').in('id', storeIds).eq('is_active', true) : Promise.resolve({ data: [] }),
  ])
  for (const [source, result] of [['Evo TV videos', videos], ['Evo Vault products', vault], ['Evo Store products', store]] as const) {
    if ('error' in result && result.error) console.error(`Failed to load magazine block resource: ${source}`, result.error)
  }
  const record = <T extends { id: string }>(rows: T[] | null | undefined) => Object.fromEntries((rows ?? []).map((row) => [row.id, row]))
  return { videos: record(videos.data as EvoTvVideo[]), vaultProducts: record(vault.data as VaultProduct[]), storeProducts: record(store.data as StoreProduct[]) }
}
