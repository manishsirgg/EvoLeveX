import type { Metadata } from 'next'
import Link from 'next/link'

import { CircleDiscussionCard } from '@/components/circle/discussion-card'
import { CirclePagination } from '@/components/circle/pagination'
import { CircleTopicCard } from '@/components/circle/topic-card'
import { getActiveCircleTopics, getCircleStartHref, getPublicCircleDiscussions, parseCirclePage } from '@/lib/circle'

const description = "Evo Circle is the EvoLeveX men's community for discussions on mindset, relationships, discipline, performance, wealth, social dynamics and life strategy."

export const metadata: Metadata = {
  title: { absolute: "Evo Circle | Men's Community | EvoLeveX" },
  description,
  alternates: { canonical: 'https://evolevex.com/circle' },
  openGraph: { title: "Evo Circle | Men's Community | EvoLeveX", description, type: 'website', url: 'https://evolevex.com/circle' },
  twitter: { card: 'summary', title: "Evo Circle | Men's Community | EvoLeveX", description },
}

export default async function CirclePage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = parseCirclePage((await searchParams).page)
  const [topicResult, discussionResult, startHref] = await Promise.all([
    getActiveCircleTopics(),
    getPublicCircleDiscussions(page),
    getCircleStartHref(),
  ])

  return (
    <main className="circle-page">
      <header className="circle-hero">
        <div>
          <p className="section-kicker">Evo Circle</p>
          <h1>Better men build<br />better conversations.</h1>
          <p>Exchange perspective with men committed to thinking clearly, acting deliberately, and raising the standard in every arena of life.</p>
          <Link href={startHref} className="button button-primary">Start a discussion <span aria-hidden="true">→</span></Link>
        </div>
        <p className="circle-hero-code" aria-hidden="true">EC / 01</p>
      </header>

      <section className="circle-topics" aria-labelledby="circle-topics-heading">
        <div className="circle-section-heading">
          <div><p className="section-index">Choose your arena</p><h2 id="circle-topics-heading">Topics</h2></div>
          <p>Find the conversation where your experience, questions, and perspective can move the community forward.</p>
        </div>
        {topicResult.hasError ? (
          <div className="circle-notice" role="status"><p>TOPICS UNAVAILABLE</p><h2>We&apos;re restoring the Circle.</h2><span>Please return shortly to explore the community topics.</span></div>
        ) : topicResult.topics.length ? (
          <div className="circle-topic-grid">{topicResult.topics.map((topic, index) => <CircleTopicCard key={topic.id} topic={topic} index={index} />)}</div>
        ) : (
          <div className="circle-empty"><span>01</span><div><p className="section-index">The rooms are being prepared</p><h3>Topics are coming soon.</h3><p>The first Evo Circle arenas will appear here as they open.</p></div></div>
        )}
      </section>

      <section className="circle-discussions" aria-labelledby="circle-discussions-heading">
        <div className="circle-section-heading circle-discussion-heading">
          <div><p className="section-index">From the community</p><h2 id="circle-discussions-heading">Recent discussions</h2></div>
          {(discussionResult.discussions.length > 0 || page > 1) ? <p>Page {page} · {discussionResult.discussions.length} {discussionResult.discussions.length === 1 ? 'conversation' : 'conversations'}</p> : null}
        </div>
        {discussionResult.hasError ? (
          <div className="circle-notice" role="status"><p>DISCUSSIONS UNAVAILABLE</p><h2>The conversation is temporarily out of reach.</h2><span>Please return shortly to reconnect with Evo Circle.</span></div>
        ) : discussionResult.discussions.length ? (
          <div className="circle-discussion-list">{discussionResult.discussions.map((discussion) => <CircleDiscussionCard key={discussion.id} discussion={discussion} />)}</div>
        ) : (
          <div className="circle-empty"><span>{page > 1 ? String(page).padStart(2, '0') : '00'}</span><div><p className="section-index">{page > 1 ? 'End of the line' : 'The first word'}</p><h3>{page > 1 ? 'No discussions on this page.' : 'Start the first conversation.'}</h3><p>{page > 1 ? 'Return to an earlier page to continue exploring.' : 'The Circle is ready for a considered question, a hard-earned lesson, or a perspective worth testing.'}</p>{page === 1 ? <Link href={startHref} className="button button-secondary">Start a discussion</Link> : <Link href="/circle" className="button button-secondary">Return to latest</Link>}</div></div>
        )}
        {!discussionResult.hasError ? <CirclePagination basePath="/circle" hasNextPage={discussionResult.hasNextPage} page={page} /> : null}
      </section>
    </main>
  )
}
