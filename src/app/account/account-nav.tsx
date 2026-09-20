'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const accountLinks = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/saved', label: 'Saved Articles' },
  { href: '/account/security', label: 'Security' },
]

export function AccountNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Account navigation" className="flex gap-1 overflow-x-auto lg:flex-col">
      {accountLinks.map((link) => {
        const isActive = pathname === link.href

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`min-w-max border-l-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
              isActive
                ? 'border-amber-300 bg-white/[0.06] text-white'
                : 'border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
      {showAdmin ? (
        <Link href="/admin" className="min-w-max border-l-2 border-transparent px-4 py-3 text-sm font-medium text-amber-300 transition-colors hover:bg-white/[0.03] hover:text-amber-200">
          Admin
        </Link>
      ) : null}
    </nav>
  )
}
