import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from './reset-password-form'

export default async function ResetPasswordPage() {
  const cookieStore = await cookies()
  const recoveryUserId = cookieStore.get('evolevex-recovery')?.value
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!recoveryUserId || error || !user || recoveryUserId !== user.id) {
    redirect('/auth/error')
  }

  return <ResetPasswordForm />
}
