import Link from 'next/link'
import {requireAdmin} from '@/lib/admin-auth'
import {getAdminStoreOrders} from '@/lib/admin-store-orders'
import {orderReference} from '@/lib/customer-orders'

function formatAmount(value:string|number,currency:string){
 const amount=Number(value)
 if(!Number.isFinite(amount))return 'Unavailable'
 try{return new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(amount)}
 catch{return `${currency} ${amount.toFixed(2)}`}
}
function formatDate(value:string){
 const date=new Date(value)
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(date)
}

export default async function StoreOrdersPage(){
 await requireAdmin()
 const {orders,error}=await getAdminStoreOrders()
 return <section aria-labelledby="store-orders-title">
  <div className="flex flex-wrap items-end justify-between gap-4">
   <div>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Operations</p>
    <h1 id="store-orders-title" className="mt-3 text-3xl font-semibold sm:text-4xl">Store orders</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Review the 50 most recent Store orders. This view cannot change payment or fulfilment status.</p>
   </div>
   <Link href="/admin/store" className="button-secondary px-4 py-3 text-sm font-bold">Back to Evo Store</Link>
  </div>
  {error ? <p role="alert" className="mt-8 border border-rose-400/30 p-5 text-sm text-rose-200">Store orders could not be loaded. No records were changed.</p>
   :orders.length===0 ? <div className="mt-8 border border-white/10 bg-zinc-900/50 p-8">
    <h2 className="text-lg font-semibold">No Store orders yet</h2>
    <p className="mt-2 text-sm text-zinc-400">Orders containing Store merchandise will appear here after customers begin checkout.</p>
    <Link href="/admin/store/products" className="mt-5 inline-block text-sm font-semibold text-amber-300">Prepare Store products</Link>
   </div>
   :<div className="mt-8 overflow-x-auto border border-white/10">
    <table className="w-full min-w-[720px] text-left text-sm">
     <thead className="border-b border-white/10 bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-400">
      <tr><th scope="col" className="px-4 py-4">Order</th><th scope="col" className="px-4 py-4">Created</th><th scope="col" className="px-4 py-4">Order status</th><th scope="col" className="px-4 py-4">Payment</th><th scope="col" className="px-4 py-4 text-right">Total</th></tr>
     </thead>
     <tbody className="divide-y divide-white/10">
      {orders.map(order=><tr key={order.id}>
       <td className="px-4 py-4 font-mono font-semibold text-white">{orderReference(order.id)}</td>
       <td className="px-4 py-4 text-zinc-400">{formatDate(order.created_at)}</td>
       <td className="px-4 py-4 capitalize text-zinc-200">{order.status.replaceAll('_',' ')}</td>
       <td className="px-4 py-4 capitalize text-zinc-200">{order.payment_status.replaceAll('_',' ')}</td>
       <td className="px-4 py-4 text-right font-semibold tabular-nums text-white">{formatAmount(order.total_amount,order.currency)}</td>
      </tr>)}
     </tbody>
    </table>
   </div>}
  <p className="mt-5 text-xs text-zinc-500">Only orders with Store items are shown. Payments and fulfilment must be verified using their dedicated workflows; statuses shown here are read-only.</p>
 </section>
}
