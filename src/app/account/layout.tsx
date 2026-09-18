import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { AccountNav } from './account-nav'
import { LogoutButton } from './logout-button'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/auth/login')

  return (
    <main className="min-h-screen flex-1 bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/account" className="text-sm font-bold uppercase tracking-[0.3em] text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300">
            EvoLeveX
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Member account</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-10 lg:py-12">
        <aside className="border-b border-white/10 pb-6 lg:border-b-0 lg:border-r lg:pr-6">
          <AccountNav />
          <div className="mt-4 hidden border-t border-white/10 pt-4 lg:block">
            <LogoutButton compact />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
        <div className="lg:hidden"><LogoutButton compact /></div>
      </div>
    </main>
  )
}
