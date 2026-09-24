'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { REPORT_RESOLUTION_NOTE_MAX, ReportStatus } from '@/lib/admin-circle-reports'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function reviewReport(id: string, intendedStatus: Exclude<ReportStatus, 'pending'>, formData: FormData) {
  const admin = await requireAdmin()
  if (!UUID.test(id)) redirect('/admin/circle/reports?error=invalid')
  const rawNote = formData.get('resolution_note')
  if (typeof rawNote !== 'string') redirect(`/admin/circle/reports/${id}?error=note`)
  const note = rawNote.trim()
  if (note.length > REPORT_RESOLUTION_NOTE_MAX) redirect(`/admin/circle/reports/${id}?error=note`)
  const supabase = await createClient()
  const { data: existing, error: lookupError } = await supabase.from('content_reports').select('id,status').eq('id', id).maybeSingle()
  if (lookupError) redirect(`/admin/circle/reports/${id}?error=update`)
  if (!existing) redirect('/admin/circle/reports?error=missing')
  if (existing.status !== 'pending' && existing.status !== intendedStatus) redirect(`/admin/circle/reports/${id}?error=transition`)
  const reviewedAt = new Date().toISOString()
  const { data, error } = await supabase.from('content_reports').update({ status: intendedStatus, reviewed_by: admin.id, reviewed_at: reviewedAt, resolution_note: note || null }).eq('id', id).eq('status', existing.status).select('id,status,reviewed_by,reviewed_at,resolution_note').maybeSingle()
  if (error || !data || data.status !== intendedStatus || data.reviewed_by !== admin.id) redirect(`/admin/circle/reports/${id}?error=update`)
  revalidatePath('/admin/circle')
  revalidatePath('/admin/circle/reports')
  revalidatePath(`/admin/circle/reports/${id}`)
  redirect(`/admin/circle/reports/${id}?success=${intendedStatus}`)
}

export async function markReportReviewed(id: string, formData: FormData) {
  return reviewReport(id, 'reviewed', formData)
}

export async function dismissReport(id: string, formData: FormData) {
  return reviewReport(id, 'dismissed', formData)
}

export async function markReportActionTaken(id: string, formData: FormData) {
  return reviewReport(id, 'action_taken', formData)
}
