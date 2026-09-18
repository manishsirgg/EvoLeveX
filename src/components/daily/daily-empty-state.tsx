import Link from 'next/link'

export function DailyEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="daily-empty">
      <span aria-hidden="true">01</span>
      <div>
        <p className="section-index">The next edition</p>
        <h3>{filtered ? 'Nothing published here—yet.' : 'Built with intention. Published with purpose.'}</h3>
        <p>{filtered ? 'New thinking for this discipline is being prepared. Explore the complete journal in the meantime.' : 'The first Evo Daily stories are being prepared. Original intelligence for deliberate progress will appear here soon.'}</p>
        {filtered && <Link href="/daily" className="text-link">View all categories <span aria-hidden="true">→</span></Link>}
      </div>
    </div>
  )
}
