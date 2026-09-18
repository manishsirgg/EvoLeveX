import Link from 'next/link'

type EcosystemPageProps = {
  eyebrow: string
  title: string
  description: string
  note: string
}

export function EcosystemPage({ eyebrow, title, description, note }: EcosystemPageProps) {
  return (
    <main className="ecosystem-page">
      <section className="ecosystem-hero" aria-labelledby="ecosystem-title">
        <p className="section-kicker">{eyebrow}</p>
        <h1 id="ecosystem-title">{title}</h1>
        <p className="ecosystem-lead">{description}</p>
        <div className="ecosystem-status">
          <span aria-hidden="true" />
          <p>{note}</p>
        </div>
      </section>
      <section className="ecosystem-next" aria-labelledby="continue-title">
        <p className="section-index">EvoLeveX / Explore</p>
        <div>
          <h2 id="continue-title">Keep moving forward.</h2>
          <p>Explore the daily ideas shaping sharper decisions and stronger performance.</p>
          <Link href="/daily" className="text-link">Explore Evo Daily <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </main>
  )
}
