import Link from 'next/link'

type DailyPaginationProps = {
  categorySlug?: string
  hasNextPage: boolean
  page: number
}

function pageHref(page: number, categorySlug?: string) {
  const query: Record<string, string> = {}
  if (categorySlug) query.category = categorySlug
  if (page > 1) query.page = String(page)
  return { pathname: '/daily', query }
}

export function DailyPagination({ categorySlug, hasNextPage, page }: DailyPaginationProps) {
  if (page === 1 && !hasNextPage) return null

  return (
    <nav className="daily-pagination" aria-label="Evo Daily article pages">
      <div>
        {page > 1 && (
          <Link href={pageHref(page - 1, categorySlug)} rel="prev">
            <span aria-hidden="true">←</span> Previous
          </Link>
        )}
      </div>
      <p>Page <strong>{page}</strong></p>
      <div>
        {hasNextPage && (
          <Link href={pageHref(page + 1, categorySlug)} rel="next">
            Next <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
