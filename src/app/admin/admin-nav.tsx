'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/daily', label: 'Evo Daily' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto lg:flex-col">
      {links.map((link) => {
        const active = link.href === '/admin' ? pathname === link.href : pathname.startsWith(link.href)
        return (
          <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}
            className={`min-w-max border-l-2 px-4 py-3 text-sm font-semibold transition-colors ${active ? 'border-amber-300 bg-white/[0.06] text-white' : 'border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-white'}`}>
            {link.label}
          </Link>
        )
      })}
      <div className="ml-4 hidden border-t border-white/10 pt-5 lg:ml-0 lg:mt-4 lg:block">
        <p className="px-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-600">Coming later</p>
        <p className="mt-3 px-4 text-xs leading-6 text-zinc-600">TV · Circle · Vault · Store · Users</p>
      </div>
    </nav>
  )
}
