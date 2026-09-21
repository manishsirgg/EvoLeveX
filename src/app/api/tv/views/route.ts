import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

const SESSION_COOKIE = 'evo_tv_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TV_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type TrackingResult = { inserted: boolean; view_count: number | string }

function isSameOrigin(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  return !origin || origin === request.nextUrl.origin
}

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
  if (keys.length !== 1 || keys[0] !== 'slug' || typeof slug !== 'string' || slug.length > 160 || !TV_SLUG.test(slug)) {
    return NextResponse.json({ error: 'Invalid video slug' }, { status: 400 })
  }

  const existingSession = request.cookies.get(SESSION_COOKIE)?.value
  const sessionId = existingSession && UUID_V4.test(existingSession) ? existingSession : crypto.randomUUID()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_evo_tv_video_view', {
    video_slug: slug,
    viewer_session_id: sessionId,
  })

  let response: NextResponse
  if (error) {
    console.error('Unable to record Evo TV video view:', error.message)
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

  if (sessionId !== existingSession) {
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })
  }

  return response
}
