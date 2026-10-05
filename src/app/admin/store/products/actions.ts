'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { mapStoreProductDatabaseError } from '@/lib/admin-store-errors'
import { isStoreUuid, parseStoreProductMutation, type StoreAdminActionState } from '@/lib/admin-store-validation'
import { createClient } from '@/lib/supabase/server'

const ARCHIVED_MESSAGE = 'Archived products are read-only and cannot be restored in the V1 admin.'
const STALE_MESSAGE = 'This product changed in another session or is no longer mutable. Refresh and try again.'

function productInput(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(['name', 'slug', 'category_id', 'description', 'short_description', 'is_featured', 'sort_order', 'seo_title', 'seo_description'].map((key) => [key, formData.get(key)]))
}

function fields(data: ReturnType<typeof parseStoreProductMutation> & { success: true }) {
  return Object.fromEntries(Object.entries(data.data).map(([key, value]) => [key, value === null ? '' : typeof value === 'boolean' ? (value ? 'on' : '') : String(value)]))
}

function revalidateProductRoutes(id?: string) {
  revalidatePath('/admin/store')
  revalidatePath('/admin/store/products')
  if (id) revalidatePath(`/admin/store/products/${id}`)
}

export async function createStoreProductAction(_state: StoreAdminActionState, formData: FormData): Promise<StoreAdminActionState> {
  await requireAdmin()
  const parsed = parseStoreProductMutation(productInput(formData))
  if (!parsed.success) return parsed.state
  const supabase = await createClient()
  const createPayload = { ...parsed.data, product_mode: 'physical' as const, publication_status: 'draft' as const }
  const { data, error } = await supabase.from('evo_store_products').insert(createPayload).select('id').single()
  if (error || !data) return { error: mapStoreProductDatabaseError(error), fields: fields(parsed) }
  revalidateProductRoutes(data.id)
  redirect(`/admin/store/products/${data.id}?success=created`)
}

export async function updateStoreProductAction(id: string, _state: StoreAdminActionState, formData: FormData): Promise<StoreAdminActionState> {
  await requireAdmin()
  if (!isStoreUuid(id)) return { error: 'This product could not be found.' }
  const parsed = parseStoreProductMutation(productInput(formData))
  if (!parsed.success) return parsed.state
  const supabase = await createClient()
  const current = await supabase.from('evo_store_products').select('publication_status').eq('id', id).maybeSingle()
  if (current.error) return { error: mapStoreProductDatabaseError(current.error), fields: fields(parsed) }
  if (!current.data) return { error: 'This product could not be found.' }
  if (current.data.publication_status === 'archived') return { error: ARCHIVED_MESSAGE }
  const { data, error } = await supabase.from('evo_store_products').update(parsed.data).eq('id', id).neq('publication_status', 'archived').select('id').maybeSingle()
  if (error) return { error: mapStoreProductDatabaseError(error), fields: fields(parsed) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(id)
  redirect(`/admin/store/products/${id}?success=updated`)
}

export async function publishStoreProductAction(id: string, _state: StoreAdminActionState, _formData: FormData): Promise<StoreAdminActionState> {
  void _state; void _formData
  await requireAdmin()
  if (!isStoreUuid(id)) return { error: 'This product could not be found.' }
  const supabase = await createClient()
  const current = await supabase.from('evo_store_products').select('publication_status').eq('id', id).maybeSingle()
  if (current.error) return { error: mapStoreProductDatabaseError(current.error) }
  if (!current.data) return { error: 'This product could not be found.' }
  if (current.data.publication_status === 'archived') return { error: ARCHIVED_MESSAGE }
  if (current.data.publication_status === 'published') return { success: 'This product is already published.' }
  await supabase.rpc('inspect_evo_store_product_readiness', { p_product_id: id }) // Advisory only; the update remains authoritative.
  const { data, error } = await supabase.from('evo_store_products').update({ publication_status: 'published' }).eq('id', id).eq('publication_status', 'draft').select('id').maybeSingle()
  if (error) return { error: mapStoreProductDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(id)
  redirect(`/admin/store/products/${id}?success=published`)
}

export async function archiveStoreProductAction(id: string, _state: StoreAdminActionState, _formData: FormData): Promise<StoreAdminActionState> {
  void _state; void _formData
  await requireAdmin()
  if (!isStoreUuid(id)) return { error: 'This product could not be found.' }
  const supabase = await createClient()
  const current = await supabase.from('evo_store_products').select('publication_status').eq('id', id).maybeSingle()
  if (current.error) return { error: mapStoreProductDatabaseError(current.error) }
  if (!current.data) return { error: 'This product could not be found.' }
  if (current.data.publication_status === 'archived') return { error: ARCHIVED_MESSAGE }
  const { data, error } = await supabase.from('evo_store_products').update({ publication_status: 'archived' }).eq('id', id).in('publication_status', ['draft', 'published']).select('id').maybeSingle()
  if (error) return { error: mapStoreProductDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(id)
  redirect(`/admin/store/products/${id}?success=archived`)
}
