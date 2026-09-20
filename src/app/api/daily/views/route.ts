import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

const SESSION_COOKIE = 'evo_daily_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type TrackingResult = { inserted: boolean; view_count: number | string }

function isSameOrigin(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false

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

  const slug = typeof body === 'object' && body !== null && 'slug' in body
    ? (body as { slug?: unknown }).slug
    : null
  if (typeof slug !== 'string' || !slug.trim() || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid article slug' }, { status: 400 })
  }

  const existingSession = request.cookies.get(SESSION_COOKIE)?.value
  const sessionId = existingSession && UUID_V4.test(existingSession)
    ? existingSession
    : crypto.randomUUID()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_evo_daily_article_view', {
    article_slug: slug,
    viewer_session_id: sessionId,
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
