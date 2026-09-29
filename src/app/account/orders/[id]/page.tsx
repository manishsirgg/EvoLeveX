import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getCustomerOrder, orderReference } from '@/lib/customer-orders'
import { dateTime, Definition, money, StatusBadge } from '../order-ui'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/auth/login')
  const result = await getCustomerOrder(supabase, id)
  if (!result.error && !result.data) notFound()

  if (result.error || !result.data) return <section aria-labelledby="order-title" className="space-y-6">
    <h1 id="order-title" className="text-3xl font-semibold text-white">Order details</h1>
    <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm text-amber-100">This order could not be loaded. Refresh the page or try again shortly.</div>
  </section>
  const order = result.data

  return <section aria-labelledby="order-title" className="space-y-8">
    <div>
      <Link href="/account/orders" className="text-sm font-semibold text-amber-300 hover:text-amber-200">← All orders</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Order details</p>
      <h1 id="order-title" className="mt-3 break-words text-3xl font-semibold tracking-tight text-white sm:text-4xl">{orderReference(order.id)}</h1>
      <p className="mt-3 text-sm text-zinc-400">Placed {dateTime(order.created_at)}</p>
      <div className="mt-4 flex flex-wrap gap-2"><StatusBadge value={order.status} /><StatusBadge value={order.payment_status} /></div>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="summary-heading" className="border border-white/10 bg-zinc-900/50 p-5 sm:p-6">
        <h2 id="summary-heading" className="text-lg font-semibold text-white">Order summary</h2>
        <dl className="mt-4"><Definition term="Currency">{order.currency}</Definition><Definition term="Subtotal">{money(order.subtotal, order.currency)}</Definition>
          <Definition term="Discount">−{money(order.discount_amount, order.currency)}</Definition><Definition term="Shipping">{money(order.shipping_amount, order.currency)}</Definition>
          <Definition term="Tax">{money(order.tax_amount, order.currency)}</Definition><Definition term="Total" strong>{money(order.total_amount, order.currency)}</Definition></dl>
      </section>

      <section aria-labelledby="payment-heading" className="border border-white/10 bg-zinc-900/50 p-5 sm:p-6">
        <h2 id="payment-heading" className="text-lg font-semibold text-white">Payment summary</h2>
        {order.payments.length === 0 ? <p className="mt-4 text-sm text-zinc-400">No payment has been recorded for this order.</p> : <div className="mt-4 space-y-6">{order.payments.map((payment, index) => {
          const refunded = Number(payment.refunded_amount) > 0
          const fullRefund = refunded && Number(payment.refunded_amount) >= Number(payment.amount)
          return <dl key={`${payment.provider}-${index}`}>
            <Definition term="Provider">{payment.provider === 'razorpay' ? 'Razorpay' : 'Online payment'}</Definition>
            <Definition term="Status"><StatusBadge value={payment.status} /></Definition>
            <Definition term="Paid amount">{money(payment.amount, payment.currency)}</Definition>
            {payment.paid_at ? <Definition term="Paid">{dateTime(payment.paid_at)}</Definition> : null}
            {refunded ? <><Definition term={fullRefund ? 'Refunded in full' : 'Partially refunded'} strong>{money(payment.refunded_amount, payment.currency)}</Definition>
              {payment.refunded_at ? <Definition term="Refunded">{dateTime(payment.refunded_at)}</Definition> : null}</> : null}
          </dl>
        })}</div>}
      </section>
    </div>

    <section aria-labelledby="items-heading">
      <h2 id="items-heading" className="text-xl font-semibold text-white">Items</h2>
      <ul className="mt-4 divide-y divide-white/10 border border-white/10 bg-zinc-900/50">{order.items.map((item) => {
        const hasLibraryAccess = item.vault_product_id ? order.activeVaultProductIds.has(item.vault_product_id) : false
        return <li key={item.id} className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
          <div className="min-w-0"><h3 className="font-semibold text-white">{item.product_name_snapshot}</h3>
            <p className="mt-1 text-sm text-zinc-400">Quantity {item.quantity} · {money(item.unit_price, order.currency)} each</p>
            <p className="mt-2 text-xs capitalize text-zinc-500">{item.source.replaceAll('_', ' ')}</p>
            {hasLibraryAccess ? <Link href="/account/library" className="mt-4 inline-flex text-sm font-semibold text-amber-300 hover:text-amber-200">View in My Library<span aria-hidden="true">&nbsp;→</span></Link> : null}
          </div><p className="font-semibold tabular-nums text-white sm:text-right">{money(item.total_price, order.currency)}</p>
        </li>
      })}</ul>
    </section>
  </section>
}
