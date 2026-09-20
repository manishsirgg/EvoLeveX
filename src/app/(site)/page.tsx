import Link from 'next/link'

const areas = [
  { href: '/daily', number: '01', title: 'Evo Daily', copy: 'Daily intelligence, strategy and practical insights for purposeful progress.' },
  { href: '/tv', number: '02', title: 'Evo TV', copy: 'Video-led ideas, analysis and perspective built to drive transformation.' },
  { href: '/circle', number: '03', title: 'Evo Circle', copy: 'A focused community for ambitious men to exchange ideas and move forward.' },
  { href: '/vault', number: '04', title: 'Evo Vault', copy: 'A curated library of books, guides and courses for deeper development.' },
  { href: '/store', number: '05', title: 'Evo Store', copy: 'Purposeful EvoLeveX merchandise and products, selected with intention.' },
]

const disciplines = [
  'Psychology', 'Dating & Relationships', 'Discipline & Focus', 'Body & Performance',
  'Style & Grooming', 'Social Dynamics', 'Wealth & Finance', 'Life Strategy', 'World Stories',
]

export default function HomePage() {
  return (
    <main>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-rule" aria-hidden="true"><span>01</span><i /></div>
        <p className="section-kicker">The men&apos;s performance academy</p>
        <h1 id="home-title">EvoLeveX</h1>
        <p className="hero-tagline">Evolve. Elevate. Excel.</p>
        <p className="hero-copy">Intelligence, tools and community for men committed to deliberate growth—and a life built at a higher standard.</p>
        <div className="hero-actions">
          <Link href="/daily" className="button button-primary">Explore Evo Daily <span aria-hidden="true">↗</span></Link>
          <Link href="/auth/register" className="button button-secondary">Join EvoLeveX</Link>
        </div>
        <p className="hero-manifesto">Think clearly <span>·</span> Act deliberately <span>·</span> Become more</p>
      </section>

      <section className="home-ecosystem" aria-labelledby="ecosystem-heading">
        <header className="section-heading">
          <div><p className="section-index">02 / The ecosystem</p><h2 id="ecosystem-heading">One standard.<br />Five dimensions.</h2></div>
          <p>Each EvoLeveX platform is designed to turn insight into action, and ambition into sustained progress.</p>
        </header>
        <div className="ecosystem-grid">
          {areas.map((area) => (
            <Link href={area.href} key={area.href} className="ecosystem-card">
              <span>{area.number}</span>
              <h3>{area.title}</h3>
              <p>{area.copy}</p>
              <b>Explore <span aria-hidden="true">↗</span></b>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-disciplines" aria-labelledby="disciplines-heading">
        <div>
          <p className="section-index">03 / The disciplines</p>
          <h2 id="disciplines-heading">Master the areas<br />that shape a man.</h2>
        </div>
        <ol>
          {disciplines.map((discipline, index) => (
            <li key={discipline}><span>{String(index + 1).padStart(2, '0')}</span>{discipline}</li>
          ))}
        </ol>
      </section>

      <section className="home-cta" aria-labelledby="cta-heading">
        <p className="section-kicker">Your next level is built</p>
        <h2 id="cta-heading">Evolution is not an event.<br />It is a practice.</h2>
        <Link href="/auth/register" className="button button-dark">Join EvoLeveX <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
  )
}
