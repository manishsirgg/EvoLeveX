'use client'

import { useActionState } from 'react'

import {
  retryRazorpayCapturedPaymentWebhookEvent,
  retryRazorpayRefundWebhookEvent,
} from './actions'
import { initialRetryCapturedPaymentState, initialRetryRefundState } from './retry-state'

export function RetryCapturedPaymentControl({ eventId }: { eventId: string }) {
  const action = retryRazorpayCapturedPaymentWebhookEvent.bind(null, eventId)
  const [state, formAction, pending] = useActionState(action, initialRetryCapturedPaymentState)

  return <RetryForm state={state} formAction={formAction} pending={pending} label="Recover captured payment" />
}

export function RetryRefundControl({ eventId }: { eventId: string }) {
  const action = retryRazorpayRefundWebhookEvent.bind(null, eventId)
  const [state, formAction, pending] = useActionState(action, initialRetryRefundState)

  return <RetryForm state={state} formAction={formAction} pending={pending} label="Retry reconciliation" />
}

function RetryForm({ state, formAction, pending, label }: {
  state: { status: 'idle' | 'success' | 'error'; message: string }
  formAction: () => void
  pending: boolean
  label: string
}) {
  return (
    <div className="min-w-52">
      <form action={formAction} onSubmit={(event) => {
        if (!window.confirm('Retry reconciliation using fresh canonical Razorpay data?')) {
          event.preventDefault()
        }
      }}>
        <button type="submit" disabled={pending}
          className="button-secondary px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? 'Retrying…' : label}
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
