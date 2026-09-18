import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const flowId = requestUrl.searchParams.get('sb_flow_id')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error', requestUrl.origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined
  )
  const redirectType = (data as typeof data & { redirectType?: string | null }).redirectType

  if (error || !data.session || !data.user || redirectType !== 'recovery') {
    return NextResponse.redirect(new URL('/auth/error', requestUrl.origin))
  }

  const response = NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
  response.cookies.set('evolevex-recovery', data.user.id, {
    httpOnly: true,
    maxAge: 30 * 60,
    path: '/auth',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
