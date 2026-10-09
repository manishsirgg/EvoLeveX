'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { mapStoreCategoryDatabaseError } from '@/lib/admin-store-errors'
import {
  isStoreUuid,
  parseStoreCategoryMutation,
  type StoreAdminActionState,
} from '@/lib/admin-store-validation'
import { createClient } from '@/lib/supabase/server'

function categoryInput(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description'),
    parent_id: formData.get('parent_id'),
    sort_order: formData.get('sort_order'),
    is_active: formData.get('is_active'),
  }
}

function revalidateCategoryRoutes(id?: string) {
  revalidatePath('/admin/store')
  revalidatePath('/admin/store/categories')
  revalidatePath('/store')
  if (id) revalidatePath(`/admin/store/categories/${id}`)
}

export async function createStoreCategoryAction(
  _state: StoreAdminActionState,
  formData: FormData,
): Promise<StoreAdminActionState> {
  await requireAdmin()
  const parsed = parseStoreCategoryMutation(categoryInput(formData))
  if (!parsed.success) return parsed.state

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_store_categories')
    .insert(parsed.data)
    .select('id')
    .single()

  if (error || !data) {
    return { error: mapStoreCategoryDatabaseError(error), fields: parsed.success ? {
      ...Object.fromEntries(Object.entries(parsed.data).map(([key, value]) => [key, value === null ? '' : String(value)])),
      is_active: parsed.data.is_active ? 'on' : '',
    } : undefined }
  }

  revalidateCategoryRoutes(data.id)
  redirect('/admin/store/categories?success=created')
}

export async function updateStoreCategoryAction(
  id: string,
  _state: StoreAdminActionState,
  formData: FormData,
): Promise<StoreAdminActionState> {
  await requireAdmin()
  if (!isStoreUuid(id)) return { error: 'This category could not be found.' }

  const parsed = parseStoreCategoryMutation(categoryInput(formData))
  if (!parsed.success) return parsed.state

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_store_categories')
    .update(parsed.data)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return { error: mapStoreCategoryDatabaseError(error), fields: {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? '',
    parent_id: parsed.data.parent_id ?? '',
    sort_order: String(parsed.data.sort_order),
    is_active: parsed.data.is_active ? 'on' : '',
  } }
  if (!data) return { error: 'This category could not be found.' }

  revalidateCategoryRoutes(id)
  redirect(`/admin/store/categories/${id}?success=updated`)
}
