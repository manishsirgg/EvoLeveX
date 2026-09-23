import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getViewerSession, isSameOrigin, setViewerSessionCookie } from '@/lib/view-tracking'

const SESSION_COOKIE = 'evo_circle_session'
const CIRCLE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const keys = Object.keys(body)
  const slug = 'slug' in body ? (body as { slug?: unknown }).slug : null
  if (keys.length !== 1 || keys[0] !== 'slug' || typeof slug !== 'string' || slug.length > 120 || !CIRCLE_SLUG.test(slug)) {
    return NextResponse.json({ error: 'Invalid discussion slug' }, { status: 400 })
  }

  const session = getViewerSession(request, SESSION_COOKIE)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_evo_circle_discussion_view', {
    discussion_slug: slug,
    viewer_session_id: session.sessionId,
  })

  let response: NextResponse
  if (error) {
    console.error('Unable to record Evo Circle discussion view:', error.message)
    response = NextResponse.json({ error: 'View tracking unavailable' }, { status: 503 })
  } else {
    const result = (Array.isArray(data) ? data[0] : data) as TrackingResult | null
    const viewCount = Number(result?.view_count ?? 0)
    response = NextResponse.json({
      inserted: Boolean(result?.inserted),
      viewCount: Number.isSafeInteger(viewCount) && viewCount >= 0 ? viewCount : 0,
    })
  }
  response.headers.set('Cache-Control', 'no-store')
  setViewerSessionCookie(response, SESSION_COOKIE, session)
  return response
}
