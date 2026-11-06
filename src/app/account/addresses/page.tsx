import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {AddAddressForm} from './add-address-form'
import {deleteShippingAddress} from './actions'

export default async function ShippingAddressesPage(){
 const db=await createClient()
 const {data:{user},error:authError}=await db.auth.getUser()
 if(authError||!user)redirect('/auth/login')
 const {data,error}=await db.from('addresses')
  .select('id,full_name,phone,address_line1,address_line2,landmark,city,state,postal_code,country,is_default')
  .eq('user_id',user.id).order('is_default',{ascending:false}).order('created_at',{ascending:false})
 return <section aria-labelledby="shipping-address-title" className="space-y-7">
  <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Account · Delivery</p>
   <h1 id="shipping-address-title" className="mt-3 text-3xl font-semibold">Shipping addresses</h1>
   <p className="mt-3 text-sm leading-6 text-zinc-400">Save a delivery address for future Evo Store orders. Checkout and payments are not enabled yet.</p>
   <Link href="/store/checkout" className="mt-4 inline-block text-sm font-semibold text-amber-300">Return to checkout review</Link>
  </div>
  {error?<p role="alert" className="border border-rose-400/30 p-5 text-sm text-rose-200">Addresses could not be loaded. Please try again.</p>:
   !data?.length?<p className="border border-white/10 p-5 text-sm text-zinc-300">No saved addresses yet.</p>:
   <ul className="grid gap-4 md:grid-cols-2">{data.map(a=><li key={a.id} className="border border-white/10 bg-zinc-900/40 p-5">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-white">{a.full_name}</h2>{a.is_default?<span className="text-xs text-amber-300">Default</span>:null}</div>
    <address className="mt-3 space-y-1 text-sm not-italic text-zinc-300">
     <p>{a.address_line1}</p>{a.address_line2?<p>{a.address_line2}</p>:null}
     {a.landmark?<p>{a.landmark}</p>:null}
     <p>{[a.city,a.state,a.postal_code].filter(Boolean).join(', ')}</p>
     <p>{a.country}</p><p>{a.phone}</p>
    </address>
    <form action={deleteShippingAddress} className="mt-4"><input type="hidden" name="address_id" value={a.id}/><button className="text-sm font-semibold text-rose-200 hover:text-rose-100">Remove address</button></form>
   </li>)}</ul>}
  <section aria-labelledby="new-address-title" className="border border-white/10 bg-zinc-900/30 p-5 sm:p-7">
   <h2 id="new-address-title" className="text-xl font-semibold">Add shipping address</h2>
   <p className="mt-2 text-xs text-zinc-400">New addresses are saved without changing any existing default. You can select any saved address during checkout.</p>
   <AddAddressForm/>
  </section>
 </section>
}
