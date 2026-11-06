'use client'
import {useActionState,useState} from 'react'
import {updateShippingAddress,type AddressActionResult} from './actions'

export type EditableAddress={
 id:string;full_name:string;phone:string;address_line1:string;
 address_line2:string|null;landmark:string|null;city:string;state:string;
 postal_code:string;country:string
}
const input='mt-1 w-full border border-white/20 bg-zinc-950 p-2.5 text-sm text-white focus:border-amber-300 focus:outline-none'
const initial:AddressActionResult={}
export function EditAddressForm({address}:{address:EditableAddress}){
 const [editing,setEditing]=useState(false)
 const [state,action,pending]=useActionState(updateShippingAddress,initial)
 return <div className="mt-4">
  <button type="button" onClick={()=>setEditing(v=>!v)} className="text-sm font-semibold text-amber-300 hover:text-amber-200" aria-expanded={editing}>{editing?'Close editor':'Edit address'}</button>
  {editing?<form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
   <input type="hidden" name="address_id" value={address.id}/>
   <label className="text-xs text-zinc-300">Full name *<input name="full_name" required maxLength={120} defaultValue={address.full_name} autoComplete="name" className={input}/></label>
   <label className="text-xs text-zinc-300">Phone *<input name="phone" type="tel" required maxLength={24} defaultValue={address.phone} autoComplete="tel" className={input}/></label>
   <label className="text-xs text-zinc-300 sm:col-span-2">Address line 1 *<input name="address_line1" required maxLength={200} defaultValue={address.address_line1} autoComplete="address-line1" className={input}/></label>
   <label className="text-xs text-zinc-300 sm:col-span-2">Address line 2<input name="address_line2" maxLength={200} defaultValue={address.address_line2??''} autoComplete="address-line2" className={input}/></label>
   <label className="text-xs text-zinc-300 sm:col-span-2">Landmark<input name="landmark" maxLength={120} defaultValue={address.landmark??''} className={input}/></label>
   <label className="text-xs text-zinc-300">City *<input name="city" required maxLength={100} defaultValue={address.city} autoComplete="address-level2" className={input}/></label>
   <label className="text-xs text-zinc-300">State *<input name="state" required maxLength={100} defaultValue={address.state} autoComplete="address-level1" className={input}/></label>
   <label className="text-xs text-zinc-300">Postal code *<input name="postal_code" required maxLength={20} defaultValue={address.postal_code} autoComplete="postal-code" className={input}/></label>
   <label className="text-xs text-zinc-300">Country *<input name="country" required maxLength={80} defaultValue={address.country} autoComplete="country-name" className={input}/></label>
   {state.error?<p role="alert" className="text-sm text-rose-300 sm:col-span-2">{state.error}</p>:null}
   {state.success?<p role="status" className="text-sm text-emerald-300 sm:col-span-2">{state.success}</p>:null}
   <button disabled={pending} className="button-primary px-4 py-2 text-sm sm:col-span-2">{pending?'Saving…':'Save changes'}</button>
  </form>:null}
 </div>
}
