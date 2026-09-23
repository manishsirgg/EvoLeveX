import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getViewerSession, isSameOrigin, setViewerSessionCookie } from '@/lib/view-tracking'

const SESSION_COOKIE = 'evo_daily_session'

type TrackingResult = { inserted: boolean; view_count: number | string }

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const slug = typeof body === 'object' && body !== null && 'slug' in body
    ? (body as { slug?: unknown }).slug
    : null
  if (typeof slug !== 'string' || !slug.trim() || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid article slug' }, { status: 400 })
  }

  const session = getViewerSession(request, SESSION_COOKIE)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_evo_daily_article_view', {
    article_slug: slug,
    viewer_session_id: session.sessionId,
  })

  if (error) {
    console.error('Unable to record Evo Daily article view:', error.message)
    return NextResponse.json({ error: 'View tracking unavailable' }, { status: 503 })
  }

  const result = (Array.isArray(data) ? data[0] : data) as TrackingResult | null
  const count = Number(result?.view_count ?? 0)
  const response = NextResponse.json({
    inserted: Boolean(result?.inserted),
    count: Number.isSafeInteger(count) && count >= 0 ? count : 0,
  })
  response.headers.set('Cache-Control', 'no-store')

  setViewerSessionCookie(response, SESSION_COOKIE, session)

  return response
}
