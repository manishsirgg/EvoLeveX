import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { PasswordForm } from './password-form'

export default async function SecurityPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/auth/login')

  return (
    <section aria-labelledby="security-title" className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Account protection</p>
        <h1 id="security-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Security</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Review your sign-in identity and maintain a strong password.</p>
      </div>

      <section aria-labelledby="email-heading" className="border border-white/10 bg-zinc-900/50 p-6 sm:p-8">
        <h2 id="email-heading" className="text-lg font-semibold text-white">Sign-in email</h2>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Email address</dt><dd className="mt-2 break-all text-sm text-zinc-200">{user.email}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Verification</dt><dd className="mt-2 text-sm text-zinc-200">{user.email_confirmed_at ? 'Verified' : 'Not verified'}</dd></div>
        </dl>
      </section>

      <PasswordForm />
    </section>
  )
}
