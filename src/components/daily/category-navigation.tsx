import Link from 'next/link'
import type { DailyCategory } from '@/lib/daily'

export function CategoryNavigation({ categories, activeSlug }: { categories: DailyCategory[], activeSlug?: string }) {
  return (
    <nav className="daily-categories" aria-label="Evo Daily categories">
      <div>
        <Link href="/daily" className={!activeSlug ? 'active' : undefined} aria-current={!activeSlug ? 'page' : undefined}>All</Link>
        {categories.map((category) => (
          <Link
            href={`/daily?category=${encodeURIComponent(category.slug)}`}
            key={category.id}
            className={activeSlug === category.slug ? 'active' : undefined}
            aria-current={activeSlug === category.slug ? 'page' : undefined}
          >{category.name}</Link>
        ))}
      </div>
    </nav>
  )
}
