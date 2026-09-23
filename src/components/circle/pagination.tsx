import Link from 'next/link'

export function CirclePagination({ basePath, hasNextPage, page }: { basePath: string; hasNextPage: boolean; page: number }) {
  if (page === 1 && !hasNextPage) return null
  const href = (target: number) => target > 1 ? `${basePath}?page=${target}` : basePath

  return (
    <nav className="circle-pagination" aria-label="Discussion pages">
      <div>{page > 1 ? <Link href={href(page - 1)} rel="prev"><span aria-hidden="true">←</span> Previous</Link> : null}</div>
      <p>Page <strong>{page}</strong></p>
      <div>{hasNextPage ? <Link href={href(page + 1)} rel="next">Next <span aria-hidden="true">→</span></Link> : null}</div>
    </nav>
  )
}
