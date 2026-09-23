import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { circleUuidPattern } from '@/lib/circle-validation'
import { createClient } from '@/lib/supabase/server'

type BookmarkRequest = { discussionId?: unknown }

async function getRequestContext(request: Request) {
  let body: BookmarkRequest
  try {
    body = await request.json() as BookmarkRequest
  } catch {
    return { error: NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  }
  if (typeof body.discussionId !== 'string' || !circleUuidPattern.test(body.discussionId)) {
    return { error: NextResponse.json({ error: 'A valid discussion is required.' }, { status: 400 }) }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  }
  return { discussionId: body.discussionId, supabase, user }
}

function revalidateBookmarkPages(slug?: string) {
  revalidatePath('/account/saved-discussions')
  if (slug) revalidatePath(`/circle/discussion/${slug}`)
}

export async function POST(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { data: discussion, error: discussionError } = await context.supabase
    .from('evo_circle_discussions')
    .select('id,slug')
    .eq('id', context.discussionId)
    .eq('status', 'published')
    .maybeSingle()
  if (discussionError || !discussion) {
    return NextResponse.json({ error: 'Discussion not available.' }, { status: 404 })
  }

  const { error } = await context.supabase.from('evo_circle_discussion_bookmarks').insert({
    user_id: context.user.id,
    discussion_id: context.discussionId,
  })
  // A repeated request is already in the desired state under the composite primary key.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not save discussion.' }, { status: 500 })
  }
  revalidateBookmarkPages(discussion.slug)
  return NextResponse.json({ saved: true })
}

export async function DELETE(request: Request) {
  const context = await getRequestContext(request)
  if ('error' in context) return context.error

  const { data: discussion } = await context.supabase
    .from('evo_circle_discussions')
    .select('slug')
    .eq('id', context.discussionId)
    .eq('status', 'published')
    .maybeSingle()
  const { error } = await context.supabase
    .from('evo_circle_discussion_bookmarks')
    .delete()
    .eq('user_id', context.user.id)
    .eq('discussion_id', context.discussionId)
  if (error) return NextResponse.json({ error: 'Could not remove saved discussion.' }, { status: 500 })

  revalidateBookmarkPages(discussion?.slug)
  return NextResponse.json({ saved: false })
}
