'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import type { VaultCategoryActionState } from '@/lib/admin-vault-validation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const keys = ['name', 'slug', 'description', 'image_url', 'sort_order']
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const fields = (data: FormData) => Object.fromEntries(keys.map(key => [key, text(data, key)]))
const fail = (error: string, data: FormData): VaultCategoryActionState => ({ error, fields: fields(data), isActive: data.get('is_active') === 'on' })
const validUrl = (value: string) => { if (!value) return true; try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }

async function mutate(id: string | null, data: FormData): Promise<VaultCategoryActionState> {
  await requireAdmin()
  if (id && !UUID.test(id)) return fail('This category is invalid.', data)
  const name = text(data, 'name')
  const slug = text(data, 'slug').toLowerCase()
  const sortRaw = text(data, 'sort_order')
  if (!name) return fail('Name is required.', data)
  if (!SLUG.test(slug) || slug.length > 160) return fail('Use a lowercase slug with words separated by hyphens.', data)
  if (!validUrl(text(data, 'image_url'))) return fail('Image URL must be an absolute HTTP or HTTPS URL.', data)
  if (!/^-?\d+$/.test(sortRaw) || !Number.isSafeInteger(Number(sortRaw))) return fail('Sort order must be a whole number.', data)

  const supabase = await createClient()
  const payload = { name, slug, description: text(data, 'description') || null, image_url: text(data, 'image_url') || null, sort_order: Number(sortRaw), is_active: data.get('is_active') === 'on' }
  const result = id
    ? await supabase.from('evo_vault_categories').update(payload).eq('id', id).select('id').single()
    : await supabase.from('evo_vault_categories').insert(payload).select('id').single()
  if (result.error || !result.data) return fail(result.error?.code === '23505' ? 'That category slug is already in use.' : 'The category could not be saved. Please try again.', data)
  revalidatePath('/admin/vault/categories')
  revalidatePath('/admin/vault/products')
  redirect(`/admin/vault/categories/${result.data.id}/edit?success=saved`)
}

export async function createVaultCategoryAction(_state: VaultCategoryActionState, data: FormData) { return mutate(null, data) }
export async function updateVaultCategoryAction(id: string, _state: VaultCategoryActionState, data: FormData) { return mutate(id, data) }
