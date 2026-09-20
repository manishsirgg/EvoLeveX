import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type BookmarkRequest = { articleId?: unknown }

async function getRequestContext(request: Request) {
  let body: BookmarkRequest
  try {
    body = await request.json() as BookmarkRequest
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

  return { articleId: body.articleId, supabase, user }
}

export async function POST(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { data: article, error: articleError } = await context.supabase
    .from('evo_daily_articles')
    .select('id')
    .eq('id', context.articleId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .maybeSingle()

  if (articleError || !article) {
    return NextResponse.json({ error: 'Article not available.' }, { status: 404 })
  }

  const { error } = await context.supabase
    .from('evo_daily_bookmarks')
    .upsert(
      { user_id: context.user.id, article_id: context.articleId },
      { onConflict: 'user_id,article_id', ignoreDuplicates: true },
    )

  if (error) return NextResponse.json({ error: 'Could not save article.' }, { status: 500 })
  return NextResponse.json({ saved: true })
}

export async function DELETE(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { error } = await context.supabase
    .from('evo_daily_bookmarks')
    .delete()
    .eq('user_id', context.user.id)
    .eq('article_id', context.articleId)

  if (error) return NextResponse.json({ error: 'Could not remove saved article.' }, { status: 500 })
  return NextResponse.json({ saved: false })
}
