import Link from 'next/link'

import { LogoutButton } from '@/app/account/logout-button'
import { requireAdmin } from '@/lib/admin-auth'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="min-h-screen flex-1 bg-[#090a0a] text-zinc-100">
      <header className="border-b border-white/10 bg-black/30">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/admin" className="font-bold tracking-[0.18em] text-white">EvoLeveX <span className="text-amber-300">Admin</span></Link>
          <div className="flex items-center gap-5 text-xs">
            <span className="hidden text-zinc-500 sm:inline">{user.email ?? 'Administrator'}</span>
            <Link href="/account" className="font-semibold text-zinc-300 hover:text-white">Account</Link>
            <Link href="/" className="font-semibold text-zinc-300 hover:text-white">Public site ↗</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[90rem] gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-10 lg:py-10">
        <aside className="border-b border-white/10 pb-6 lg:border-b-0 lg:border-r lg:pr-6">
          <AdminNav />
          <div className="mt-5 hidden border-t border-white/10 pt-5 lg:block"><LogoutButton compact /></div>
        </aside>
        <main className="min-w-0">{children}</main>
        <div className="lg:hidden"><LogoutButton compact /></div>
      </div>
    </div>
  )
}
