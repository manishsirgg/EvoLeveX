import { NextResponse } from 'next/server'

import { circleUuidPattern } from '@/lib/circle-validation'
import { createClient } from '@/lib/supabase/server'

async function context(request: Request) {
  let value: unknown
  try { value = await request.json() } catch { return { response: NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) } }
  const discussionId = typeof value === 'object' && value && 'discussionId' in value ? (value as { discussionId?: unknown }).discussionId : null
  if (typeof discussionId !== 'string' || !circleUuidPattern.test(discussionId)) return { response: NextResponse.json({ error: 'A valid discussion is required.' }, { status: 400 }) }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  return { discussionId, supabase, user }
}

async function count(value: Exclude<Awaited<ReturnType<typeof context>>, { response: NextResponse }>) {
  const result = await value.supabase.rpc('get_evo_circle_discussion_like_count', { discussion_uuid: value.discussionId })
  const likeCount = Number(result.data ?? 0)
  return result.error || !Number.isSafeInteger(likeCount) || likeCount < 0 ? null : likeCount
}

export async function POST(request: Request) {
  const value = await context(request)
  if ('response' in value) return value.response
  const available = await value.supabase.from('evo_circle_discussions').select('id').eq('id', value.discussionId).eq('status', 'published').maybeSingle()
  if (available.error || !available.data) return NextResponse.json({ error: 'Discussion not available.' }, { status: 404 })
  const result = await value.supabase.from('evo_circle_discussion_likes').upsert({ user_id: value.user.id, discussion_id: value.discussionId }, { onConflict: 'user_id,discussion_id', ignoreDuplicates: true })
  if (result.error) return NextResponse.json({ error: 'Could not like discussion.' }, { status: 500 })
  const likeCount = await count(value)
  return likeCount === null ? NextResponse.json({ error: 'Could not load like count.' }, { status: 500 }) : NextResponse.json({ liked: true, likeCount })
}

export async function DELETE(request: Request) {
  const value = await context(request)
  if ('response' in value) return value.response
  const result = await value.supabase.from('evo_circle_discussion_likes').delete().eq('user_id', value.user.id).eq('discussion_id', value.discussionId)
  if (result.error) return NextResponse.json({ error: 'Could not remove like.' }, { status: 500 })
  const likeCount = await count(value)
  return likeCount === null ? NextResponse.json({ error: 'Could not load like count.' }, { status: 500 }) : NextResponse.json({ liked: false, likeCount })
}
