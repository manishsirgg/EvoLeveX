'use client'

import { useState } from 'react'

import { CircleLikeControl } from '@/components/circle/like-control'
import { CircleReplyComposer } from '@/components/circle/reply-composer'
import type { CircleReply } from '@/lib/circle'

function date(value: string) { return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) }

export function CircleReplyList({ replies, discussionId, path, authenticated, canReply }: { replies: CircleReply[]; discussionId: string; path: string; authenticated: boolean; canReply: boolean }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  return <div className="circle-reply-list">
    {replies.map((reply) => <article id={`reply-${reply.id}`} key={reply.id} className={`circle-reply${reply.nested ? ' circle-reply-nested' : ''}`}>
      <header><strong>{reply.authorName}</strong><time dateTime={reply.created_at}>{date(reply.created_at)} UTC</time></header>
      <p className="circle-reply-body">{reply.body}</p>
      <footer>
        <CircleLikeControl id={reply.id} path={path} authenticated={authenticated} initiallyLiked={reply.liked} initialCount={reply.likeCount} kind="reply" />
        {canReply ? <button type="button" className="circle-reply-action" aria-expanded={replyingTo === reply.id} onClick={() => setReplyingTo((current) => current === reply.id ? null : reply.id)}>Reply</button> : null}
      </footer>
      {replyingTo === reply.id ? <CircleReplyComposer discussionId={discussionId} parentReplyId={reply.id} onCancel={() => setReplyingTo(null)} /> : null}
    </article>)}
  </div>
}
