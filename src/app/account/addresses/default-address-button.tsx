'use client'

import {useActionState} from 'react'
import {setDefaultShippingAddress,type AddressActionResult} from './actions'

const initial:AddressActionResult={}
export function DefaultAddressButton({addressId}:{addressId:string}){
 const [result,action,pending]=useActionState(setDefaultShippingAddress,initial)
 return <form action={action} className="mt-4">
  <input type="hidden" name="address_id" value={addressId}/>
  <button disabled={pending} className="text-sm font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50">
   {pending?'Updating default…':'Make default'}
  </button>
  {result.error?<p role="alert" className="mt-2 text-xs text-rose-300">{result.error}</p>:null}
  {result.success?<p role="status" className="mt-2 text-xs text-emerald-300">{result.success}</p>:null}
 </form>
}
