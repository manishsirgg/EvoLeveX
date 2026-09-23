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
  const { data, error } = await supabase
    .from('evo_circle_discussions')
    .update(values)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) redirect(`/admin/circle/discussions/${id}?error=update`)
  if (!data) redirect('/admin/circle/discussions?error=missing')
  revalidatePath('/admin/circle/discussions')
  revalidatePath(`/admin/circle/discussions/${id}`)
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
