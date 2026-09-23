import { NextRequest, NextResponse } from 'next/server'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSameOrigin(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  return !origin || origin === request.nextUrl.origin
}

export function getViewerSession(request: NextRequest, cookieName: string) {
  const existingSession = request.cookies.get(cookieName)?.value
  const sessionId = existingSession && UUID_V4.test(existingSession)
    ? existingSession
    : crypto.randomUUID()

  return { existingSession, sessionId }
}

export function setViewerSessionCookie(
  response: NextResponse,
  cookieName: string,
  session: ReturnType<typeof getViewerSession>,
) {
  if (session.sessionId === session.existingSession) return
  response.cookies.set(cookieName, session.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}
