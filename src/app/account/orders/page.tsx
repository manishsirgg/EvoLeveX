import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getCustomerOrders, isExpiredCheckout, orderReference } from '@/lib/customer-orders'
import { dateTime, money, StatusBadge } from './order-ui'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/auth/login')
  const result = await getCustomerOrders(supabase)
  const orders = result.data ?? []

  return <section aria-labelledby="orders-title" className="space-y-8">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Purchase history</p>
      <h1 id="orders-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Orders</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Review your orders, payments, and access to purchased digital books.</p>
    </div>
    {result.error ? <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm text-amber-100">
      Your orders could not be loaded. Refresh the page or try again shortly.
    </div> : orders.length === 0 ? <div className="border border-white/10 bg-zinc-900/50 p-8 sm:p-10">
      <h2 className="text-xl font-semibold text-white">No orders yet</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">Your completed and pending purchases will appear here.</p>
      <Link href="/vault" className="button-light mt-6 inline-flex px-5 py-3 text-sm">Explore Evo Vault</Link>
    </div> : <ul className="divide-y divide-white/10 border border-white/10 bg-zinc-900/50">
      {orders.map((order) => <li key={order.id} className="p-5 sm:p-6">
        <article className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="font-semibold text-white">Order {orderReference(order.id)}</p>
            <p className="mt-1 text-sm text-zinc-400">{dateTime(order.created_at)}</p>
            <div className="mt-3 flex flex-wrap gap-2">{isExpiredCheckout(order)
              ? <StatusBadge value="expired" />
              : <><StatusBadge value={order.status} /><StatusBadge value={order.payment_status} /></>}</div>
          </div>
          <div className="sm:text-right">
            <p className="text-lg font-semibold tabular-nums text-white">{money(order.total_amount, order.currency)}</p>
            <Link href={`/account/orders/${order.id}`} className="mt-3 inline-flex text-sm font-semibold text-amber-300 hover:text-amber-200">View details<span aria-hidden="true">&nbsp;→</span></Link>
          </div>
        </article>
      </li>)}
    </ul>}
  </section>
}
