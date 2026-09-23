import { NextResponse } from 'next/server'

import { validateCircleReport } from '@/lib/circle-reporting'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = validateCircleReport(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { targetType, targetId, reason, details } = parsed.data
  let ownerId: string | null = null
  if (targetType === 'discussion') {
    const target = await supabase.from('evo_circle_discussions').select('id,author_id').eq('id', targetId).eq('status', 'published').maybeSingle()
    if (target.error || !target.data) return NextResponse.json({ error: 'Discussion not available.' }, { status: 404 })
    ownerId = target.data.author_id
  } else {
    const target = await supabase.from('evo_circle_replies').select('id,author_id,discussion_id').eq('id', targetId).eq('status', 'published').maybeSingle()
    if (target.error || !target.data) return NextResponse.json({ error: 'Reply not available.' }, { status: 404 })
    ownerId = target.data.author_id
    const discussion = await supabase.from('evo_circle_discussions').select('id').eq('id', target.data.discussion_id).eq('status', 'published').maybeSingle()
    if (discussion.error || !discussion.data) return NextResponse.json({ error: 'Reply not available.' }, { status: 404 })
  }
  if (ownerId === user.id) return NextResponse.json({ error: 'You cannot report your own content.' }, { status: 403 })

  const targetColumn = targetType === 'discussion' ? 'discussion_id' : 'reply_id'
  const existing = await supabase.from('content_reports').select('id').eq('reporter_id', user.id).eq('content_type', targetType).eq(targetColumn, targetId).maybeSingle()
  if (existing.data) return NextResponse.json({ reported: true, duplicate: true })
  if (existing.error) return NextResponse.json({ error: 'Could not check report status.' }, { status: 500 })

  const report = await supabase.from('content_reports').insert({
    reporter_id: user.id,
    content_type: targetType,
    [targetColumn]: targetId,
    reason,
    details,
  })
  if (report.error?.code === '23505') return NextResponse.json({ reported: true, duplicate: true })
  if (report.error) return NextResponse.json({ error: 'Could not submit report.' }, { status: 500 })
  return NextResponse.json({ reported: true })
}
