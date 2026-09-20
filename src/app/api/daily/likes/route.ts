import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type LikeRequest = { articleId?: unknown }

async function getRequestContext(request: Request) {
  let body: LikeRequest
  try {
    body = await request.json() as LikeRequest
  } catch {
    return { error: NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  }

  if (typeof body.articleId !== 'string' || !body.articleId.trim()) {
    return { error: NextResponse.json({ error: 'An article is required.' }, { status: 400 }) }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  }

  const { data: article, error: articleError } = await supabase
    .from('evo_daily_articles')
    .select('id')
    .eq('id', body.articleId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .maybeSingle()

  if (articleError || !article) {
    return { error: NextResponse.json({ error: 'Article not available.' }, { status: 404 }) }
  }

  return { articleId: body.articleId, supabase, user }
}

async function getLikeCount(context: Awaited<ReturnType<typeof getRequestContext>>) {
  if ('error' in context) return null
  const { data, error } = await context.supabase.rpc('get_evo_daily_article_like_count', {
    article_uuid: context.articleId,
  })
  const count = Number(data ?? 0)
  return error || !Number.isSafeInteger(count) || count < 0 ? null : count
}

export async function POST(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { error } = await context.supabase
    .from('evo_daily_likes')
    .upsert(
      { user_id: context.user.id, article_id: context.articleId },
      { onConflict: 'user_id,article_id', ignoreDuplicates: true },
    )

  if (error) return NextResponse.json({ error: 'Could not like article.' }, { status: 500 })
  const likeCount = await getLikeCount(context)
  if (likeCount === null) return NextResponse.json({ error: 'Could not load like count.' }, { status: 500 })
  return NextResponse.json({ liked: true, likeCount })
}

export async function DELETE(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { error } = await context.supabase
    .from('evo_daily_likes')
    .delete()
    .eq('user_id', context.user.id)
    .eq('article_id', context.articleId)

  if (error) return NextResponse.json({ error: 'Could not remove like.' }, { status: 500 })
  const likeCount = await getLikeCount(context)
  if (likeCount === null) return NextResponse.json({ error: 'Could not load like count.' }, { status: 500 })
  return NextResponse.json({ liked: false, likeCount })
}
