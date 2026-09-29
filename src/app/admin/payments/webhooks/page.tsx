import { requireAdmin } from '@/lib/admin-auth'
import { extractRazorpayWebhook, validateRazorpayEventId } from '@/lib/razorpay-webhook'
import { createClient } from '@/lib/supabase/server'

import { RetryRefundControl } from './retry-control'

type WebhookEvent = {
  id: string
  provider: string
  received_at: string
  event_type: string
  processing_status: string
  attempt_count: number
  provider_event_id: string
  provider_payment_id: string | null
  provider_refund_id: string | null
  safe_error_code: string | null
  processed_at: string | null
  payload: unknown
  payload_sha256: string | null
}

const shown = (value: string | null) => value ?? '—'
const time = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'UTC' }) : '—'
const SHA256 = /^[a-f0-9]{64}$/

function isEligible(event: WebhookEvent) {
  if (event.provider !== 'razorpay' || event.event_type !== 'refund.processed'
    || event.processing_status !== 'failed' || event.processed_at !== null
    || event.payload === null || !SHA256.test(event.payload_sha256 ?? '')
    || !validateRazorpayEventId(event.provider_event_id)) return false
  try {
    const extracted = extractRazorpayWebhook(event.payload)
    return extracted.supported && extracted.eventType === 'refund.processed'
      && extracted.providerPaymentId === event.provider_payment_id
      && extracted.providerRefundId === event.provider_refund_id
      && extracted.refundAmount !== null && extracted.refundCurrency !== null
  } catch {
    return false
  }
}

export default async function PaymentWebhooksPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payment_webhook_events')
    .select('id,provider,received_at,event_type,processing_status,attempt_count,provider_event_id,provider_payment_id,provider_refund_id,safe_error_code,processed_at,payload,payload_sha256')
    .eq('provider', 'razorpay')
    .order('received_at', { ascending: false })
    .limit(100)
  const events = (data ?? []) as WebhookEvent[]

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Payments</p>
      <h1 className="mt-3 text-3xl font-semibold">Razorpay webhooks</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
        Recent signed webhook receipts. Retry is limited to failed processed-refund reconciliation
        and verifies fresh canonical provider state before changing payment records.
      </p>
      {error && <p role="alert" className="mt-6 border border-rose-400/30 p-4 text-rose-200">
        Webhook events could not be loaded.
      </p>}
      {!error && (
        <div className="mt-7 overflow-x-auto border border-white/10">
          <table className="min-w-[1150px] w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
              <tr>{['Received (UTC)', 'Event', 'Status', 'Attempts', 'Provider event', 'Payment', 'Refund', 'Safe error', 'Processed (UTC)', 'Action'].map((label) => (
                <th key={label} className="px-3 py-3 font-semibold">{label}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {events.map((event) => {
                const eligible = isEligible(event)
                return (
                  <tr key={event.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-400">{time(event.received_at)}</td>
                    <td className="px-3 py-4 font-medium">{event.event_type}</td>
                    <td className="px-3 py-4">{event.processing_status}</td>
                    <td className="px-3 py-4 tabular-nums">{event.attempt_count}</td>
                    <td className="max-w-48 break-all px-3 py-4 text-zinc-400">{event.provider_event_id}</td>
                    <td className="max-w-44 break-all px-3 py-4 text-zinc-400">{shown(event.provider_payment_id)}</td>
                    <td className="max-w-44 break-all px-3 py-4 text-zinc-400">{shown(event.provider_refund_id)}</td>
                    <td className="px-3 py-4 text-rose-300">{shown(event.safe_error_code)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-zinc-400">{time(event.processed_at)}</td>
                    <td className="px-3 py-4">{eligible ? <RetryRefundControl eventId={event.id} /> : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!events.length && <p className="p-8 text-center text-zinc-400">No Razorpay webhook events found.</p>}
        </div>
      )}
    </section>
  )
}
