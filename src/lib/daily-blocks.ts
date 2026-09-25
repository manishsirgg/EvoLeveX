import type { SupportedCurrency } from '@/lib/currency'

export const DAILY_BLOCK_TYPES = ['section_heading', 'pull_quote', 'divider', 'image', 'callout', 'evo_tv', 'evo_vault', 'evo_store', 'affiliate', 'cta'] as const
export type DailyBlockType = typeof DAILY_BLOCK_TYPES[number]
export const DAILY_BLOCK_LABELS: Record<DailyBlockType, string> = {
  section_heading: 'Section Heading', pull_quote: 'Pull Quote', divider: 'Divider', image: 'Editorial Image', callout: 'Callout',
  evo_tv: 'Evo TV Video', evo_vault: 'Evo Vault Promotion', evo_store: 'Evo Store Promotion', affiliate: 'Affiliate Recommendation', cta: 'CTA',
}

export type DailyBlock = {
  id: string; article_id: string; block_type: DailyBlockType; position_after_paragraph: number; sort_order: number
  heading: string | null; body: string | null; image_url: string | null; image_alt: string | null; caption: string | null
  evo_tv_video_id: string | null; vault_product_id: string | null; store_product_id: string | null
  external_url: string | null; button_label: string | null; affiliate_disclosure: string | null
  metadata: Record<string, unknown>; is_active: boolean; created_at: string
}
export type EvoTvVideo = { id: string; youtube_video_id: string; title: string; description: string | null; thumbnail_url: string | null; duration_seconds: number | null; slug: string; active: boolean; published_at?: string | null }
export type VaultProduct = { id: string; kind: string; name: string; slug: string; short_description: string | null; description: string | null; price: number | string | null; currency: SupportedCurrency | null; cover_image_url: string | null; is_active: boolean }
export type StoreProduct = { id: string; name: string; slug: string; short_description: string | null; base_price: number | string | null; currency: SupportedCurrency | null; cover_image_url: string | null; is_active: boolean }
export type DailyBlockResources = { videos: Record<string, EvoTvVideo>; vaultProducts: Record<string, VaultProduct>; storeProducts: Record<string, StoreProduct> }

export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null } catch { return null }
}
