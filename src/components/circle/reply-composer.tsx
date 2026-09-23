'use client'

import { useActionState, useEffect, useRef } from 'react'

import { createReply } from '@/app/(site)/circle/discussion/[slug]/actions'
import { CIRCLE_REPLY_LIMITS, initialCreateReplyState } from '@/lib/circle-validation'

export function CircleReplyComposer({ discussionId, parentReplyId, onCancel }: { discussionId: string; parentReplyId?: string; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(createReply, initialCreateReplyState)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => { if (state.success) formRef.current?.reset() }, [state.success])
  return <form ref={formRef} action={action} className={`circle-reply-composer${parentReplyId ? ' circle-inline-reply' : ''}`} noValidate>
    <input type="hidden" name="discussionId" value={discussionId} />
    {parentReplyId ? <input type="hidden" name="parentReplyId" value={parentReplyId} /> : null}
    <label htmlFor={`reply-${parentReplyId ?? 'discussion'}`}>{parentReplyId ? 'Write your response' : 'Add to the conversation'}</label>
    <textarea id={`reply-${parentReplyId ?? 'discussion'}`} name="body" required minLength={CIRCLE_REPLY_LIMITS.bodyMin} maxLength={CIRCLE_REPLY_LIMITS.bodyMax} rows={parentReplyId ? 4 : 7} placeholder="Write a considered reply…" aria-invalid={Boolean(state.fieldError)} aria-describedby={state.fieldError ? `reply-error-${parentReplyId ?? 'discussion'}` : undefined} />
    {state.fieldError ? <p id={`reply-error-${parentReplyId ?? 'discussion'}`} className="circle-field-error">{state.fieldError}</p> : null}
    <div className="circle-reply-submit"><span>{CIRCLE_REPLY_LIMITS.bodyMin}–{CIRCLE_REPLY_LIMITS.bodyMax.toLocaleString()} characters · Plain text</span><div>{onCancel ? <button type="button" className="circle-text-button" onClick={onCancel}>Cancel</button> : null}<button type="submit" className="button button-primary" disabled={pending}>{pending ? 'Publishing…' : 'Publish reply'}</button></div></div>
    <div aria-live="polite">{state.error ? <p className="circle-form-error" role="alert">{state.error}</p> : null}{state.success ? <p className="circle-reply-success" role="status">{state.success}</p> : null}</div>
  </form>
}
