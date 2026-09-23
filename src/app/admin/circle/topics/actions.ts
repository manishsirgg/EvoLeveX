'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import {
  CIRCLE_TOPIC_LIMITS,
  CircleTopicActionState,
  normalizeCircleTopicSlug,
} from '@/lib/admin-circle-validation'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim()

function fieldsFrom(formData: FormData) {
  return Object.fromEntries(['name', 'slug', 'description', 'icon', 'sort_order'].map((key) => [key, text(formData, key)]))
}

function failure(error: string, formData: FormData, slug?: string): CircleTopicActionState {
  const fields = fieldsFrom(formData)
  if (slug !== undefined) fields.slug = slug
  return { error, fields, isActive: formData.get('is_active') === 'on' }
}

async function mutateTopic(id: string | null, formData: FormData): Promise<CircleTopicActionState> {
  await requireAdmin()

  if (id !== null && !UUID.test(id)) return failure('This topic could not be found.', formData)

  const name = text(formData, 'name')
  const slug = normalizeCircleTopicSlug(text(formData, 'slug'))
  const description = text(formData, 'description')
  const icon = text(formData, 'icon')
  const sortRaw = text(formData, 'sort_order')
  const sortOrder = Number(sortRaw)

  if (!name) return failure('Name is required.', formData, slug)
  if (name.length > CIRCLE_TOPIC_LIMITS.name) return failure(`Name must be ${CIRCLE_TOPIC_LIMITS.name} characters or fewer.`, formData, slug)
  if (!slug) return failure('Enter a slug containing letters or numbers.', formData, slug)
  if (slug.length > CIRCLE_TOPIC_LIMITS.slug) return failure(`Slug must be ${CIRCLE_TOPIC_LIMITS.slug} characters or fewer.`, formData, slug)
  if (description.length > CIRCLE_TOPIC_LIMITS.description) return failure(`Description must be ${CIRCLE_TOPIC_LIMITS.description} characters or fewer.`, formData, slug)
  if (icon.length > CIRCLE_TOPIC_LIMITS.icon) return failure(`Icon must be ${CIRCLE_TOPIC_LIMITS.icon} characters or fewer.`, formData, slug)
  if (!/^-?\d+$/.test(sortRaw) || !Number.isSafeInteger(sortOrder)) return failure('Sort order must be a whole number.', formData, slug)

  const supabase = await createClient()
  const payload = {
    name,
    slug,
    description: description || null,
    icon: icon || null,
    sort_order: sortOrder,
    is_active: formData.get('is_active') === 'on',
  }
  const result = id
    ? await supabase.from('evo_circle_topics').update(payload).eq('id', id).select('id').single()
    : await supabase.from('evo_circle_topics').insert(payload).select('id').single()

  if (result.error || !result.data) {
    const message = result.error?.code === '23505'
      ? 'That topic slug is already in use.'
      : 'The topic could not be saved. Please try again.'
    return failure(message, formData, slug)
  }

  revalidatePath('/admin/circle')
  revalidatePath('/admin/circle/topics')
  redirect(`/admin/circle/topics/${result.data.id}/edit?success=saved`)
}

export async function createTopicAction(_state: CircleTopicActionState, formData: FormData) {
  return mutateTopic(null, formData)
}

export async function updateTopicAction(id: string, _state: CircleTopicActionState, formData: FormData) {
  return mutateTopic(id, formData)
}
