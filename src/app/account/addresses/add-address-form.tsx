'use client'
import {useActionState} from 'react'
import {addShippingAddress,type AddressActionResult} from './actions'

const input='mt-1 w-full border border-white/20 bg-zinc-950 p-3 text-sm text-white focus:border-amber-300 focus:outline-none'
const initial:AddressActionResult={}
export function AddAddressForm(){
 const [state,action,pending]=useActionState(addShippingAddress,initial)
 return <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
  <label className="text-sm text-zinc-300">Full name *<input name="full_name" required maxLength={120} className={input} autoComplete="name"/></label>
  <label className="text-sm text-zinc-300">Phone *<input name="phone" type="tel" required maxLength={24} className={input} autoComplete="tel"/></label>
  <label className="text-sm text-zinc-300 sm:col-span-2">Address line 1 *<input name="address_line1" required maxLength={200} className={input} autoComplete="address-line1"/></label>
  <label className="text-sm text-zinc-300 sm:col-span-2">Address line 2<input name="address_line2" maxLength={200} className={input} autoComplete="address-line2"/></label>
  <label className="text-sm text-zinc-300 sm:col-span-2">Landmark<input name="landmark" maxLength={120} className={input}/></label>
  <label className="text-sm text-zinc-300">City *<input name="city" required maxLength={100} className={input} autoComplete="address-level2"/></label>
  <label className="text-sm text-zinc-300">State *<input name="state" required maxLength={100} className={input} autoComplete="address-level1"/></label>
  <label className="text-sm text-zinc-300">Postal code *<input name="postal_code" required maxLength={20} className={input} autoComplete="postal-code"/></label>
  <label className="text-sm text-zinc-300">Country *<input name="country" required maxLength={80} defaultValue="India" className={input} autoComplete="country-name"/></label>
  {state.error?<p role="alert" className="text-sm text-rose-300 sm:col-span-2">{state.error}</p>:null}
  {state.success?<p role="status" className="text-sm text-emerald-300 sm:col-span-2">{state.success}</p>:null}
  <button disabled={pending} className="button-primary px-5 py-3 text-sm sm:col-span-2">{pending?'Saving…':'Save shipping address'}</button>
 </form>
}
