'use client'

import { useActionState } from 'react'

import { createDiscussion } from '@/app/(site)/circle/new/actions'
import type { CircleTopic } from '@/lib/circle'
import { CIRCLE_DISCUSSION_LIMITS, initialCreateDiscussionState } from '@/lib/circle-validation'

export function DiscussionComposer({ topics }: { topics: CircleTopic[] }) {
  const [state, formAction, pending] = useActionState(createDiscussion, initialCreateDiscussionState)

  return (
    <form action={formAction} className="circle-composer" noValidate>
      <div className="circle-field">
        <label htmlFor="circle-topic">Topic</label>
        <select id="circle-topic" name="topic" required defaultValue={state.fields?.topic ?? ''} aria-invalid={Boolean(state.fieldErrors?.topic)} aria-describedby={state.fieldErrors?.topic ? 'circle-topic-error' : undefined}>
          <option value="" disabled>Select a topic</option>
          {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.icon ? `${topic.icon} ` : ''}{topic.name}</option>)}
        </select>
        {state.fieldErrors?.topic ? <p id="circle-topic-error" className="circle-field-error">{state.fieldErrors.topic}</p> : null}
      </div>
      <div className="circle-field">
        <div className="circle-field-heading"><label htmlFor="circle-title">Title</label><span>{CIRCLE_DISCUSSION_LIMITS.titleMin}–{CIRCLE_DISCUSSION_LIMITS.titleMax} characters</span></div>
        <input id="circle-title" name="title" required minLength={CIRCLE_DISCUSSION_LIMITS.titleMin} maxLength={CIRCLE_DISCUSSION_LIMITS.titleMax} defaultValue={state.fields?.title ?? ''} placeholder="What do you want to discuss?" aria-invalid={Boolean(state.fieldErrors?.title)} aria-describedby={state.fieldErrors?.title ? 'circle-title-error' : undefined} />
        {state.fieldErrors?.title ? <p id="circle-title-error" className="circle-field-error">{state.fieldErrors.title}</p> : null}
      </div>
      <div className="circle-field">
        <div className="circle-field-heading"><label htmlFor="circle-body">Discussion</label><span>{CIRCLE_DISCUSSION_LIMITS.bodyMin.toLocaleString()}–{CIRCLE_DISCUSSION_LIMITS.bodyMax.toLocaleString()} characters</span></div>
        <textarea id="circle-body" name="body" required minLength={CIRCLE_DISCUSSION_LIMITS.bodyMin} maxLength={CIRCLE_DISCUSSION_LIMITS.bodyMax} rows={12} defaultValue={state.fields?.body ?? ''} placeholder="Share the context, question, or perspective that will help members contribute." aria-invalid={Boolean(state.fieldErrors?.body)} aria-describedby={state.fieldErrors?.body ? 'circle-body-help circle-body-error' : 'circle-body-help'} />
        <p id="circle-body-help" className="circle-field-help">Plain text only. Be specific, constructive, and respectful.</p>
        {state.fieldErrors?.body ? <p id="circle-body-error" className="circle-field-error">{state.fieldErrors.body}</p> : null}
      </div>
      <div aria-live="polite">{state.error ? <p role="alert" className="circle-form-error">{state.error}</p> : null}</div>
      <div className="circle-composer-submit">
        <p>Your discussion will be public immediately.</p>
        <button type="submit" disabled={pending || topics.length === 0} className="button button-primary">{pending ? 'Publishing…' : 'Publish discussion'}</button>
      </div>
    </form>
  )
}
