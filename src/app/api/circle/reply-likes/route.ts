import { NextResponse } from 'next/server'

import { circleUuidPattern } from '@/lib/circle-validation'
import { createClient } from '@/lib/supabase/server'

async function context(request: Request) {
  let value: unknown
  try { value = await request.json() } catch { return { response: NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) } }
  const replyId = typeof value === 'object' && value && 'replyId' in value ? (value as { replyId?: unknown }).replyId : null
  if (typeof replyId !== 'string' || !circleUuidPattern.test(replyId)) return { response: NextResponse.json({ error: 'A valid reply is required.' }, { status: 400 }) }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  return { replyId, supabase, user }
}

async function count(value: Exclude<Awaited<ReturnType<typeof context>>, { response: NextResponse }>) {
  const result = await value.supabase.rpc('get_evo_circle_reply_like_count', { reply_uuid: value.replyId })
  const likeCount = Number(result.data ?? 0)
  return result.error || !Number.isSafeInteger(likeCount) || likeCount < 0 ? null : likeCount
}

export async function POST(request: Request) {
  const value = await context(request)
  if ('response' in value) return value.response
  const available = await value.supabase.from('evo_circle_replies').select('id').eq('id', value.replyId).eq('status', 'published').maybeSingle()
  if (available.error || !available.data) return NextResponse.json({ error: 'Reply not available.' }, { status: 404 })
  const result = await value.supabase.from('evo_circle_reply_likes').upsert({ user_id: value.user.id, reply_id: value.replyId }, { onConflict: 'user_id,reply_id', ignoreDuplicates: true })
  if (result.error) return NextResponse.json({ error: 'Could not like reply.' }, { status: 500 })
  const likeCount = await count(value)
  return likeCount === null ? NextResponse.json({ error: 'Could not load like count.' }, { status: 500 }) : NextResponse.json({ liked: true, likeCount })
}

export async function DELETE(request: Request) {
  const value = await context(request)
  if ('response' in value) return value.response
  const result = await value.supabase.from('evo_circle_reply_likes').delete().eq('user_id', value.user.id).eq('reply_id', value.replyId)
  if (result.error) return NextResponse.json({ error: 'Could not remove like.' }, { status: 500 })
  const likeCount = await count(value)
  return likeCount === null ? NextResponse.json({ error: 'Could not load like count.' }, { status: 500 }) : NextResponse.json({ liked: false, likeCount })
}
