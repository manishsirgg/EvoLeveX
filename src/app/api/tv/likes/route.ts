import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type LikeRequest = { videoId?: unknown }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getRequestContext(request: Request) {
  let body: LikeRequest
  try {
    body = await request.json() as LikeRequest
  } catch {
    return { error: NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  }

  if (typeof body.videoId !== 'string' || !uuidPattern.test(body.videoId)) {
    return { error: NextResponse.json({ error: 'A valid video is required.' }, { status: 400 }) }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  }

  return { videoId: body.videoId, supabase, user }
}

async function getLikeCount(context: Awaited<ReturnType<typeof getRequestContext>>) {
  if ('error' in context) return null

  const { data, error } = await context.supabase.rpc('get_evo_tv_video_like_count', {
    video_uuid: context.videoId,
  })
  const count = Number(data ?? 0)
  return error || !Number.isSafeInteger(count) || count < 0 ? null : count
}

export async function POST(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const requestTime = new Date().toISOString()
  const { data: video, error: videoError } = await context.supabase
    .from('evo_tv_videos')
    .select('id')
    .eq('id', context.videoId)
    .eq('active', true)
    .or(`published_at.is.null,published_at.lte.${requestTime}`)
    .maybeSingle()

  if (videoError || !video) {
    return NextResponse.json({ error: 'Video not available.' }, { status: 404 })
  }

  const { error } = await context.supabase
    .from('evo_tv_video_likes')
    .upsert(
      { user_id: context.user.id, video_id: context.videoId },
      { onConflict: 'user_id,video_id', ignoreDuplicates: true },
    )

  if (error) return NextResponse.json({ error: 'Could not like video.' }, { status: 500 })

  const likeCount = await getLikeCount(context)
  if (likeCount === null) return NextResponse.json({ error: 'Could not load like count.' }, { status: 500 })
  return NextResponse.json({ liked: true, likeCount })
}

export async function DELETE(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { error } = await context.supabase
    .from('evo_tv_video_likes')
    .delete()
    .eq('user_id', context.user.id)
    .eq('video_id', context.videoId)

  if (error) return NextResponse.json({ error: 'Could not remove like.' }, { status: 500 })

  const likeCount = await getLikeCount(context)
  if (likeCount === null) return NextResponse.json({ error: 'Could not load like count.' }, { status: 500 })
  return NextResponse.json({ liked: false, likeCount })
}
