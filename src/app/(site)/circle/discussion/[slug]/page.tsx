import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CircleDiscussionShare } from '@/components/circle/discussion-share'
import { CircleLikeControl } from '@/components/circle/like-control'
import { CircleReplyComposer } from '@/components/circle/reply-composer'
import { CircleReplyList } from '@/components/circle/reply-list'
import { CircleReportControl } from '@/components/circle/report-control'
import { getCircleDiscussionConversation, getPublicCircleDiscussion } from '@/lib/circle'
import { createClient } from '@/lib/supabase/server'

type Props = { params: Promise<{ slug: string }> }
const canonical = (slug: string) => `https://evolevex.com/circle/discussion/${encodeURIComponent(slug)}`
const description = (body: string) => {
  const plain = body.replace(/\s+/g, ' ').trim()
  if (!plain) return 'Join this public Evo Circle discussion with the EvoLeveX community.'
  return plain.slice(0, 157).replace(/\s+\S*$/, '') + (plain.length > 157 ? '…' : '')
}
const formatDate = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const discussion = await getPublicCircleDiscussion((await params).slug)
  if (!discussion) return { robots: { index: false, follow: false } }
  const summary = description(discussion.body)
  const url = canonical(discussion.slug)
  return { title: `${discussion.title} | Evo Circle`, description: summary, alternates: { canonical: url }, openGraph: { title: discussion.title, description: summary, type: 'article', url }, twitter: { card: 'summary', title: discussion.title, description: summary } }
}

export default async function CircleDiscussionPage({ params }: Props) {
  const discussion = await getPublicCircleDiscussion((await params).slug)
  if (!discussion) notFound()
  const conversation = await getCircleDiscussionConversation(discussion.id)
  const supabase = await createClient()
  const discussionLike = conversation.user ? await supabase.from('evo_circle_discussion_likes').select('discussion_id').eq('user_id', conversation.user.id).eq('discussion_id', discussion.id).maybeSingle() : null
  const path = `/circle/discussion/${encodeURIComponent(discussion.slug)}`
  const topicHref = discussion.topic ? `/circle/topic/${encodeURIComponent(discussion.topic.slug)}` : '/circle'
  return <main className="circle-page circle-detail-page">
    <Link href={topicHref} className="circle-back-link">← Back to {discussion.topic?.name ?? 'Evo Circle'}</Link>
    <article className="circle-detail">
      <header className="circle-detail-header">
        <div className="circle-detail-labels">{discussion.topic ? <Link href={topicHref}>{discussion.topic.name}</Link> : <span>Evo Circle</span>}{discussion.pinned ? <span>Pinned</span> : null}{discussion.locked ? <span>Replies locked</span> : null}</div>
        <h1>{discussion.title}</h1>
        <div className="circle-detail-meta"><span>By {discussion.authorName}</span><time dateTime={discussion.created_at}>{formatDate(discussion.created_at)} UTC</time><span>{discussion.view_count.toLocaleString('en')} {discussion.view_count === 1 ? 'view' : 'views'}</span></div>
      </header>
      <div className="circle-detail-body">{discussion.body}</div>
      <div className="circle-detail-actions"><CircleLikeControl id={discussion.id} path={path} authenticated={Boolean(conversation.user)} initiallyLiked={Boolean(discussionLike?.data)} initialCount={conversation.discussionLikeCount} kind="discussion" /><CircleDiscussionShare title={discussion.title} url={canonical(discussion.slug)} />{discussion.author_id !== conversation.user?.id ? <CircleReportControl targetType="discussion" targetId={discussion.id} path={path} authenticated={Boolean(conversation.user)} initiallyReported={conversation.discussionReported} /> : null}</div>
    </article>
    <section className="circle-conversation" aria-labelledby="circle-conversation-title">
      <header className="circle-conversation-heading"><div><p className="section-index">Evo Circle / Conversation</p><h2 id="circle-conversation-title">Replies</h2></div><span>{conversation.replies.length}{conversation.truncated ? '+' : ''} {conversation.replies.length === 1 ? 'reply' : 'replies'}</span></header>
      {conversation.hasError ? <div className="circle-notice" role="status"><p>REPLIES UNAVAILABLE</p><h2>The conversation could not be loaded.</h2><span>Please try again shortly.</span></div> : conversation.replies.length ? <CircleReplyList replies={conversation.replies} discussionId={discussion.id} path={path} authenticated={Boolean(conversation.user)} canReply={Boolean(conversation.user) && !discussion.locked} /> : <p className="circle-conversation-empty">No replies yet. Add the first considered perspective.</p>}
      {discussion.locked ? <p className="circle-locked-notice">This discussion is closed to new replies.</p> : conversation.user ? <CircleReplyComposer discussionId={discussion.id} /> : <div className="circle-sign-in"><p>Join the conversation with your perspective.</p><Link className="button button-secondary" href={`/auth/login?next=${encodeURIComponent(path)}`}>Sign in to reply</Link></div>}
      {conversation.truncated ? <p className="circle-truncated">Showing the first 100 replies in chronological order.</p> : null}
    </section>
  </main>
}
