import Link from 'next/link'

type DailyEmptyStateProps = {
  categorySlug?: string
  filtered: boolean
  page?: number
  featuredOnly?: boolean
}

export function DailyEmptyState({ categorySlug, filtered, page = 1, featuredOnly = false }: DailyEmptyStateProps) {
  const beyondAvailable = page > 1
  const title = beyondAvailable
    ? 'You’ve reached the end.'
    : featuredOnly
      ? 'More intelligence is on the way.'
      : filtered ? 'Nothing published here—yet.' : 'Built with intention. Published with purpose.'
  const description = beyondAvailable
    ? 'There are no published stories on this page. Return to the previous page or begin again with the latest intelligence.'
    : featuredOnly
      ? 'Explore today’s featured story above. New editions will join it here as they are published.'
      : filtered ? 'New thinking for this discipline is being prepared. Explore the complete journal in the meantime.' : 'The first Evo Daily stories are being prepared. Original intelligence for deliberate progress will appear here soon.'

  return (
    <div className="daily-empty">
      <span aria-hidden="true">01</span>
      <div>
        <p className="section-index">The next edition</p>
        <h3>{title}</h3>
        <p>{description}</p>
        {beyondAvailable ? (
          <Link href={{ pathname: '/daily', query: categorySlug ? { category: categorySlug } : {} }} className="text-link">Return to latest <span aria-hidden="true">→</span></Link>
        ) : filtered && !featuredOnly ? (
          <Link href="/daily" className="text-link">View all categories <span aria-hidden="true">→</span></Link>
        ) : null}
      </div>
    </div>
  )
}
