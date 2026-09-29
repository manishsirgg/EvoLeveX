'use client'

import { useActionState } from 'react'

import {
  initialRetryRefundState,
  retryRazorpayRefundWebhookEvent,
} from './actions'

export function RetryRefundControl({ eventId }: { eventId: string }) {
  const action = retryRazorpayRefundWebhookEvent.bind(null, eventId)
  const [state, formAction, pending] = useActionState(action, initialRetryRefundState)

  return (
    <div className="min-w-52">
      <form action={formAction} onSubmit={(event) => {
        if (!window.confirm('Retry reconciliation using fresh canonical Razorpay data?')) {
          event.preventDefault()
        }
      }}>
        <button type="submit" disabled={pending}
          className="button-secondary px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? 'Retrying…' : 'Retry reconciliation'}
        </button>
      </form>
      {state.message && (
        <p role={state.status === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-xs ${state.status === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {state.message}
        </p>
      )}
    </div>
  )
}
