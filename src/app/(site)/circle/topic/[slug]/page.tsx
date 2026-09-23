import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CircleDiscussionCard } from '@/components/circle/discussion-card'
import { CirclePagination } from '@/components/circle/pagination'
import { getActiveCircleTopic, getCircleStartHref, getPublicCircleDiscussions, parseCirclePage } from '@/lib/circle'

type TopicPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[]; created?: string | string[] }>
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const topic = await getActiveCircleTopic((await params).slug)
  if (!topic) return {}
  const title = `${topic.name} | Evo Circle`
  const description = topic.description?.trim() || `Join Evo Circle discussions about ${topic.name.toLowerCase()} with the EvoLeveX community.`
  const canonical = `https://evolevex.com/circle/topic/${encodeURIComponent(topic.slug)}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | EvoLeveX`, description, type: 'website', url: canonical },
    twitter: { card: 'summary', title: `${title} | EvoLeveX`, description },
  }
}

export default async function CircleTopicPage({ params, searchParams }: TopicPageProps) {
  const topic = await getActiveCircleTopic((await params).slug)
  if (!topic) notFound()
  const query = await searchParams
  const page = parseCirclePage(query.page)
  const [discussionResult, startHref] = await Promise.all([getPublicCircleDiscussions(page, topic.id), getCircleStartHref()])

  return (
    <main className="circle-page circle-topic-page">
      <Link href="/circle" className="circle-back-link">← All Circle topics</Link>
      <header className="circle-topic-hero">
        <div className="circle-topic-hero-icon" aria-hidden="true">{topic.icon || 'EC'}</div>
        <div>
          <p className="section-kicker">Evo Circle / Topic</p>
          <h1>{topic.name}</h1>
          {topic.description ? <p>{topic.description}</p> : null}
          <Link href={startHref} className="button button-primary">Start a discussion <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      {query.created === '1' ? <p className="circle-success" role="status">Discussion published successfully.</p> : null}

      <section className="circle-discussions circle-topic-discussions" aria-labelledby="topic-discussions-heading">
        <div className="circle-section-heading circle-discussion-heading">
          <div><p className="section-index">Inside the topic</p><h2 id="topic-discussions-heading">Discussions</h2></div>
          {(discussionResult.discussions.length > 0 || page > 1) ? <p>Page {page} · {discussionResult.discussions.length} {discussionResult.discussions.length === 1 ? 'conversation' : 'conversations'}</p> : null}
        </div>
        {discussionResult.hasError ? (
          <div className="circle-notice" role="status"><p>DISCUSSIONS UNAVAILABLE</p><h2>This topic is temporarily out of reach.</h2><span>Please return shortly to reconnect with the conversation.</span></div>
        ) : discussionResult.discussions.length ? (
          <div className="circle-discussion-list">{discussionResult.discussions.map((discussion) => <CircleDiscussionCard key={discussion.id} discussion={discussion} showTopic={false} />)}</div>
        ) : (
          <div className="circle-empty"><span>{page > 1 ? String(page).padStart(2, '0') : '00'}</span><div><p className="section-index">{page > 1 ? 'No results here' : 'Open the floor'}</p><h3>{page > 1 ? 'No discussions on this page.' : `Begin the ${topic.name} conversation.`}</h3><p>{page > 1 ? 'Return to an earlier page to continue exploring.' : 'Bring a useful question or a point of view that invites thoughtful challenge.'}</p>{page === 1 ? <Link href={startHref} className="button button-secondary">Start a discussion</Link> : <Link href={`/circle/topic/${encodeURIComponent(topic.slug)}`} className="button button-secondary">Return to latest</Link>}</div></div>
        )}
        {!discussionResult.hasError ? <CirclePagination basePath={`/circle/topic/${encodeURIComponent(topic.slug)}`} hasNextPage={discussionResult.hasNextPage} page={page} /> : null}
      </section>
    </main>
  )
}
