import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type BookmarkRequest = { videoId?: unknown }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getRequestContext(request: Request) {
  let body: BookmarkRequest
  try {
    body = await request.json() as BookmarkRequest
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

export async function POST(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const now = new Date().toISOString()
  const { data: video, error: videoError } = await context.supabase
    .from('evo_tv_videos')
    .select('id')
    .eq('id', context.videoId)
    .eq('active', true)
    .or(`published_at.is.null,published_at.lte.${now}`)
    .maybeSingle()

  if (videoError || !video) {
    return NextResponse.json({ error: 'Video not available.' }, { status: 404 })
  }

  const { error } = await context.supabase
    .from('evo_tv_video_bookmarks')
    .upsert(
      { user_id: context.user.id, video_id: context.videoId },
      { onConflict: 'user_id,video_id', ignoreDuplicates: true },
    )

  if (error) return NextResponse.json({ error: 'Could not save video.' }, { status: 500 })
  return NextResponse.json({ saved: true })
}

export async function DELETE(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { error } = await context.supabase
    .from('evo_tv_video_bookmarks')
    .delete()
    .eq('user_id', context.user.id)
    .eq('video_id', context.videoId)

  if (error) return NextResponse.json({ error: 'Could not remove saved video.' }, { status: 500 })
  return NextResponse.json({ saved: false })
}
