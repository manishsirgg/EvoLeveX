import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const flowId = searchParams.get('sb_flow_id')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined
    )

    if (error) {
      redirect('/auth/error')
    }

    redirect('/account')
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    })

    if (error) {
      redirect('/auth/error')
    }

    redirect('/account')
  }

  redirect('/auth/error')
}
