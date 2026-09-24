'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function updateDiscussion(id: string, values: { pinned: boolean } | { locked: boolean } | { status: 'published' | 'removed' }) {
  await requireAdmin()
  if (!UUID.test(id)) redirect('/admin/circle/discussions?error=invalid')

  const supabase = await createClient()
  let query = supabase.from('evo_circle_discussions').update(values).eq('id', id)
  if ('locked' in values) query = query.eq('status', 'published')
  const { data, error } = await query
    .select('id')
    .maybeSingle()

  if (error) redirect(`/admin/circle/discussions/${id}?error=update`)
  if (!data) redirect('/admin/circle/discussions?error=missing')
  revalidatePath('/admin/circle/discussions')
  revalidatePath(`/admin/circle/discussions/${id}`)
  revalidatePath('/admin/circle/reports')
  revalidatePath('/admin/circle/reports/[id]', 'page')
  redirect(`/admin/circle/discussions/${id}?success=updated`)
}

export async function setDiscussionPinned(id: string, pinned: boolean, formData: FormData) {
  void formData
  return updateDiscussion(id, { pinned })
}

export async function setDiscussionLocked(id: string, locked: boolean, formData: FormData) {
  void formData
  return updateDiscussion(id, { locked })
}

export async function removeDiscussion(id: string, formData: FormData) {
  void formData
  return updateDiscussion(id, { status: 'removed' })
}

export async function restoreDiscussion(id: string, formData: FormData) {
  void formData
  return updateDiscussion(id, { status: 'published' })
}

async function updateReply(discussionId: string, replyId: string, status: 'published' | 'removed') {
  await requireAdmin()
  if (!UUID.test(discussionId) || !UUID.test(replyId)) redirect('/admin/circle/discussions?error=invalid')
  const supabase = await createClient()
  const { data: existing, error: lookupError } = await supabase.from('evo_circle_replies').select('id,discussion_id').eq('id', replyId).eq('discussion_id', discussionId).maybeSingle()
  if (lookupError) redirect(`/admin/circle/discussions/${discussionId}?error=update`)
  if (!existing) redirect(`/admin/circle/discussions/${discussionId}?error=missing`)
  const { data, error } = await supabase.from('evo_circle_replies').update({ status }).eq('id', replyId).eq('discussion_id', discussionId).select('id,status').maybeSingle()
  if (error) {
    console.error('Admin Circle reply status update failed', {
      action: status === 'removed' ? 'removeReply' : 'restoreReply',
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      discussionId,
      replyId,
      intendedStatus: status,
    })
  }
  if (error || !data || data.status !== status) redirect(`/admin/circle/discussions/${discussionId}?error=update#reply-${replyId}`)
  revalidatePath(`/admin/circle/discussions/${discussionId}`)
  revalidatePath('/admin/circle/reports')
  revalidatePath('/admin/circle/reports/[id]', 'page')
  redirect(`/admin/circle/discussions/${discussionId}?success=reply#reply-${replyId}`)
}

export async function removeReply(discussionId: string, replyId: string, formData: FormData) {
  void formData
  return updateReply(discussionId, replyId, 'removed')
}

export async function restoreReply(discussionId: string, replyId: string, formData: FormData) {
  void formData
  return updateReply(discussionId, replyId, 'published')
}
