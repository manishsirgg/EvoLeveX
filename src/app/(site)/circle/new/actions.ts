'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  CIRCLE_DISCUSSION_LIMITS,
  normalizeDiscussionSlug,
  type CreateDiscussionState,
} from '@/lib/circle-validation'
import { createClient } from '@/lib/supabase/server'

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export async function createDiscussion(_: CreateDiscussionState, formData: FormData): Promise<CreateDiscussionState> {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/auth/login?next=%2Fcircle%2Fnew')

  const fields = {
    topic: fieldValue(formData, 'topic'),
    title: fieldValue(formData, 'title'),
    body: fieldValue(formData, 'body'),
  }
  const fieldErrors: CreateDiscussionState['fieldErrors'] = {}
  if (!fields.topic) fieldErrors.topic = 'Choose a topic.'
  if (fields.title.length < CIRCLE_DISCUSSION_LIMITS.titleMin || fields.title.length > CIRCLE_DISCUSSION_LIMITS.titleMax) {
    fieldErrors.title = `Use ${CIRCLE_DISCUSSION_LIMITS.titleMin}–${CIRCLE_DISCUSSION_LIMITS.titleMax} characters.`
  }
  if (fields.body.length < CIRCLE_DISCUSSION_LIMITS.bodyMin || fields.body.length > CIRCLE_DISCUSSION_LIMITS.bodyMax) {
    fieldErrors.body = `Use ${CIRCLE_DISCUSSION_LIMITS.bodyMin.toLocaleString()}–${CIRCLE_DISCUSSION_LIMITS.bodyMax.toLocaleString()} characters.`
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, fields }

  const topicResult = await supabase
    .from('evo_circle_topics')
    .select('id,slug')
    .eq('id', fields.topic)
    .eq('is_active', true)
    .maybeSingle()
  if (topicResult.error) return { error: 'We could not verify that topic. Please try again.', fields }
  if (!topicResult.data) return { fieldErrors: { topic: 'That topic is no longer available.' }, fields }

  const baseSlug = normalizeDiscussionSlug(fields.title) || 'discussion'
  let insertError: { code?: string } | null = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`
    const result = await supabase.from('evo_circle_discussions').insert({
      topic_id: topicResult.data.id,
      author_id: authData.user.id,
      title: fields.title,
      slug,
      body: fields.body,
      status: 'published',
      pinned: false,
      locked: false,
      view_count: 0,
    }).select('id').single()
    insertError = result.error
    if (!result.error) {
      revalidatePath('/circle')
      revalidatePath(`/circle/topic/${topicResult.data.slug}`)
      redirect(`/circle/topic/${encodeURIComponent(topicResult.data.slug)}?created=1`)
    }
    if (result.error.code !== '23505') break
  }

  return {
    error: insertError?.code === '42501'
      ? 'Your session cannot publish a discussion. Please sign in again and retry.'
      : 'We could not publish your discussion right now. Please try again.',
    fields,
  }
}
