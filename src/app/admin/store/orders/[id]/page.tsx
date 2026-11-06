import Link from 'next/link'
import {notFound} from 'next/navigation'
import {requireAdmin} from '@/lib/admin-auth'
import {getAdminStoreOrderDetail} from '@/lib/admin-store-order-detail'
import {orderReference} from '@/lib/customer-orders'

function money(value:number|string,currency:string){
 const amount=Number(value)
 if(!Number.isFinite(amount))return 'Unavailable'
 try{return new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(amount)}
 catch{return `${currency} ${amount.toFixed(2)}`}
}
function when(value:string){
 const date=new Date(value)
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(date)
}
function Detail({label,children}:{label:string;children:React.ReactNode}){
 return <div className="flex justify-between gap-4 border-b border-white/10 py-3 text-sm"><dt className="text-zinc-400">{label}</dt><dd className="text-right text-white">{children}</dd></div>
}

export default async function AdminStoreOrderDetailPage({params}:{params:Promise<{id:string}>}){
 await requireAdmin()
 const {id}=await params
 const {order,error}=await getAdminStoreOrderDetail(id)
 if(!error&&!order)notFound()
 return <section aria-labelledby="store-order-detail-title" className="space-y-7">
  <div>
   <Link href="/admin/store/orders" className="text-sm font-semibold text-amber-300 hover:text-amber-200">← Store orders</Link>
   <h1 id="store-order-detail-title" className="mt-4 break-words text-3xl font-semibold">Order {order?orderReference(order.id):'details'}</h1>
   <p className="mt-3 text-sm text-zinc-400">Read-only order inspection. Payment and fulfilment actions are not available here.</p>
  </div>
  {error||!order?<p role="alert" className="border border-rose-400/30 p-5 text-sm text-rose-200">The order could not be loaded. No records were changed.</p>:<>
   <div className="grid gap-5 lg:grid-cols-2">
    <section className="border border-white/10 bg-zinc-900/40 p-5" aria-label="Order and payment summary">
     <h2 className="text-lg font-semibold">Order summary</h2>
     <dl className="mt-4">
      <Detail label="Created">{when(order.created_at)}</Detail>
      <Detail label="Order status"><span className="capitalize">{order.status.replaceAll('_',' ')}</span></Detail>
      <Detail label="Payment status"><span className="capitalize">{order.payment_status.replaceAll('_',' ')}</span></Detail>
      <Detail label="Subtotal">{money(order.subtotal,order.currency)}</Detail>
      <Detail label="Discount">{money(order.discount_amount,order.currency)}</Detail>
      <Detail label="Shipping">{money(order.shipping_amount,order.currency)}</Detail>
      <Detail label="Tax">{money(order.tax_amount,order.currency)}</Detail>
      <Detail label="Total"><strong>{money(order.total_amount,order.currency)}</strong></Detail>
     </dl>
    </section>
    <section className="border border-white/10 bg-zinc-900/40 p-5" aria-label="Shipping address">
     <h2 className="text-lg font-semibold">Delivery details</h2>
     {order.shipping_address_line1?<address className="mt-4 space-y-1 text-sm not-italic leading-6 text-zinc-200">
      {order.shipping_name?<p className="font-semibold text-white">{order.shipping_name}</p>:null}
      <p>{order.shipping_address_line1}</p>
      {order.shipping_address_line2?<p>{order.shipping_address_line2}</p>:null}
      {order.shipping_landmark?<p>{order.shipping_landmark}</p>:null}
      <p>{[order.shipping_city,order.shipping_state,order.shipping_postal_code].filter(Boolean).join(', ')}</p>
      {order.shipping_country?<p>{order.shipping_country}</p>:null}
      {order.shipping_phone?<p>{order.shipping_phone}</p>:null}
     </address>:<p className="mt-4 text-sm text-zinc-400">No delivery address recorded.</p>}
    </section>
   </div>
   <section className="border border-white/10 bg-zinc-900/40 p-5" aria-labelledby="store-order-items-title">
    <h2 id="store-order-items-title" className="text-lg font-semibold">Order items</h2>
    <ul className="mt-4 divide-y divide-white/10">{order.items.map(item=><li key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
     <div><p className="font-semibold text-white">{item.product_name_snapshot}</p>
      <p className="mt-1 text-sm text-zinc-400">{item.sku_snapshot??'No SKU'} · Quantity {item.quantity} · {money(item.unit_price,order.currency)} each</p>
      <p className="mt-1 text-xs capitalize text-zinc-500">{item.source.replaceAll('_',' ')}</p>
     </div>
     <p className="font-semibold tabular-nums">{money(item.total_price,order.currency)}</p>
    </li>)}</ul>
   </section>
  </>}
 </section>
}
