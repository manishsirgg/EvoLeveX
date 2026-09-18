import { redirect } from 'next/navigation'

import { LogoutButton } from './logout-button'
import { createClient } from '@/lib/supabase/server'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <section
        aria-labelledby="account-title"
        className="w-full max-w-md border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/30 sm:p-10"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">EvoLeveX</p>
        <p className="mt-3 text-sm font-medium tracking-wide text-amber-300">Authenticated session</p>
        <h1 id="account-title" className="mt-8 text-3xl font-semibold tracking-tight text-white">You&apos;re signed in.</h1>
        <p className="mt-3 text-base leading-7 text-zinc-400">You are signed in to EvoLeveX as:</p>
        <p className="mt-2 break-all text-base font-medium text-zinc-100">{user.email}</p>
        <LogoutButton />
      </section>
    </main>
  )
}
