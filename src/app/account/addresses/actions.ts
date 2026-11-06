'use server'

import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'

export type AddressActionResult={error?:string;success?:string}
const field=(form:FormData,key:string,max:number)=>{
 const value=form.get(key)
 return typeof value==='string'&&value.trim().length<=max?value.trim():null
}
export async function addShippingAddress(_:AddressActionResult,form:FormData):Promise<AddressActionResult>{
 const db=await createClient()
 const {data:{user},error:authError}=await db.auth.getUser()
 if(authError||!user)return {error:'Sign in to save a shipping address.'}
 const full_name=field(form,'full_name',120),phone=field(form,'phone',24)
 const address_line1=field(form,'address_line1',200),address_line2=field(form,'address_line2',200)
 const landmark=field(form,'landmark',120),city=field(form,'city',100)
 const state=field(form,'state',100),postal_code=field(form,'postal_code',20),country=field(form,'country',80)
 if(!full_name||!phone||!address_line1||!city||!state||!postal_code||!country
  ||address_line2===null||landmark===null
  ||!/^[+0-9()\-\s]{7,24}$/.test(phone)
  ||!/^[A-Za-z0-9][A-Za-z0-9\-\s]{2,19}$/.test(postal_code))
  return {error:'Check the required address fields, phone number and postal code.'}
 const {error}=await db.from('addresses').insert({
  user_id:user.id,full_name,phone,address_line1,address_line2:address_line2||null,
  landmark:landmark||null,city,state,postal_code,country,is_default:false,
 })
 if(error)return {error:'Address could not be saved. Please review the details and try again.'}
 revalidatePath('/account/addresses')
 revalidatePath('/store/checkout')
 return {success:'Shipping address saved.'}
}
export async function deleteShippingAddress(form:FormData):Promise<void>{
 const db=await createClient()
 const {data:{user},error:authError}=await db.auth.getUser()
 if(authError||!user)return
 const id=form.get('address_id')
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return
 await db.from('addresses').delete().eq('id',id).eq('user_id',user.id)
 revalidatePath('/account/addresses')
 revalidatePath('/store/checkout')
}

/** Edit only the requested address owned by the current authenticated user.
 * Default state and ownership are deliberately excluded from writable fields.
 */
export async function updateShippingAddress(_:AddressActionResult,form:FormData):Promise<AddressActionResult>{
 const db=await createClient()
 const {data:{user},error:authError}=await db.auth.getUser()
 if(authError||!user)return {error:'Sign in to update a shipping address.'}
 const id=form.get('address_id')
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  return {error:'Invalid address. Refresh the page and try again.'}
 const full_name=field(form,'full_name',120),phone=field(form,'phone',24)
 const address_line1=field(form,'address_line1',200),address_line2=field(form,'address_line2',200)
 const landmark=field(form,'landmark',120),city=field(form,'city',100)
 const state=field(form,'state',100),postal_code=field(form,'postal_code',20),country=field(form,'country',80)
 if(!full_name||!phone||!address_line1||!city||!state||!postal_code||!country
  ||address_line2===null||landmark===null
  ||!/^[+0-9()\\-\\s]{7,24}$/.test(phone)
  ||!/^[A-Za-z0-9][A-Za-z0-9\\-\\s]{2,19}$/.test(postal_code))
  return {error:'Check the required address fields, phone number and postal code.'}
 const {data,error}=await db.from('addresses').update({
  full_name,phone,address_line1,address_line2:address_line2||null,
  landmark:landmark||null,city,state,postal_code,country,
 }).eq('id',id).eq('user_id',user.id).select('id').maybeSingle()
 if(error||!data)return {error:'Address could not be updated. Refresh and try again.'}
 revalidatePath('/account/addresses')
 revalidatePath('/store/checkout')
 return {success:'Shipping address updated.'}
}
