'use server'

import { revalidatePath } from 'next/cache'

import { CIRCLE_REPLY_LIMITS, circleUuidPattern, type CreateReplyState } from '@/lib/circle-validation'
import { createClient } from '@/lib/supabase/server'

export async function createReply(_: CreateReplyState, formData: FormData): Promise<CreateReplyState> {
  const discussionId = typeof formData.get('discussionId') === 'string' ? String(formData.get('discussionId')) : ''
  const parentValue = formData.get('parentReplyId')
  const parentReplyId = typeof parentValue === 'string' && parentValue ? parentValue : null
  const body = typeof formData.get('body') === 'string' ? String(formData.get('body')).trim() : ''
  if (!circleUuidPattern.test(discussionId) || (parentReplyId && !circleUuidPattern.test(parentReplyId))) return { error: 'The reply target is invalid.' }
  if (body.length < CIRCLE_REPLY_LIMITS.bodyMin || body.length > CIRCLE_REPLY_LIMITS.bodyMax) return { fieldError: `Use ${CIRCLE_REPLY_LIMITS.bodyMin}–${CIRCLE_REPLY_LIMITS.bodyMax.toLocaleString()} characters.` }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Your session has ended. Sign in and try again.' }
  const discussion = await supabase.from('evo_circle_discussions').select('id,slug,locked,status').eq('id', discussionId).eq('status', 'published').maybeSingle()
  if (discussion.error || !discussion.data) return { error: 'This discussion is no longer available.' }
  if (discussion.data.locked) return { error: 'This discussion is closed to new replies.' }
  let normalizedParentId = parentReplyId
  if (parentReplyId) {
    const parent = await supabase.from('evo_circle_replies').select('id,discussion_id,parent_reply_id,status').eq('id', parentReplyId).eq('discussion_id', discussionId).eq('status', 'published').maybeSingle()
    if (parent.error || !parent.data) return { error: 'The reply you selected is no longer available.' }
    // Keep the stored conversation one level deep when replying to an existing child.
    if (parent.data.parent_reply_id) {
      const root = await supabase.from('evo_circle_replies').select('id').eq('id', parent.data.parent_reply_id).eq('discussion_id', discussionId).eq('status', 'published').maybeSingle()
      if (root.error || !root.data) return { error: 'The reply thread is no longer available.' }
      normalizedParentId = root.data.id
    }
  }
  const result = await supabase.from('evo_circle_replies').insert({ discussion_id: discussionId, parent_reply_id: normalizedParentId, author_id: user.id, body, status: 'published' }).select('id').single()
  if (result.error) return { error: result.error.code === '42501' ? 'This discussion no longer accepts replies.' : 'We could not publish your reply. Please try again.' }
  revalidatePath(`/circle/discussion/${discussion.data.slug}`)
  return { success: 'Reply published.' }
}
