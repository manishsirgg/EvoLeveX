import Link from 'next/link'

import type { CircleDiscussionSummary } from '@/lib/circle'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))
}

export function CircleDiscussionCard({ discussion, showTopic = true }: { discussion: CircleDiscussionSummary; showTopic?: boolean }) {
  return (
    <article className={`circle-discussion-card${discussion.pinned ? ' circle-discussion-pinned' : ''}`}>
      <div className="circle-discussion-mark" aria-hidden="true">{discussion.pinned ? '◆' : '○'}</div>
      <div className="circle-discussion-copy">
        <div className="circle-discussion-labels">
          {discussion.pinned ? <span className="circle-pinned-label">Pinned</span> : null}
          {discussion.locked ? <span>Replies locked</span> : null}
          {showTopic && discussion.topic ? <Link href={`/circle/topic/${encodeURIComponent(discussion.topic.slug)}`}>{discussion.topic.name}</Link> : null}
        </div>
        <h3><Link className="circle-discussion-title-link" href={`/circle/discussion/${encodeURIComponent(discussion.slug)}`}>{discussion.title}</Link></h3>
        <div className="circle-discussion-meta">
          <span>By {discussion.authorName}</span>
          <time dateTime={discussion.created_at}>{formatDate(discussion.created_at)} UTC</time>
          <span>{discussion.view_count.toLocaleString('en')} {discussion.view_count === 1 ? 'view' : 'views'}</span>
        </div>
      </div>
    </article>
  )
}
