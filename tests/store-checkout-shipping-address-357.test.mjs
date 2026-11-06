import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=(p)=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('checkout loads authenticated user address descriptions only when reservation admitted',async()=>{
 const page=await read('src/app/(site)/store/checkout/page.tsx')
 assert.ok(page.indexOf('if (reservationEnabled)')<page.indexOf("supabase.auth.getUser()"))
 for(const marker of [".eq('user_id',user.id)","full_name,address_line1,city,state,postal_code,country","order('is_default',{ascending:false})","typeof a.full_name === 'string'"])assert.ok(page.includes(marker),marker)
 assert.doesNotMatch(page,/service_role|createAdminClient/)
})

test('checkout displays recognizable selected address without allowing reselection after reservation',async()=>{
 const component=await read('src/components/store/store-checkout-review.tsx')
 for(const marker of ["selectedAddressDetails=addresses.find(a=>a.id===selectedAddress)","address.full_name","address.city","address.postal_code","Deliver to {selectedAddressDetails.full_name}","reservationResult==='created'","disabled={submitting||reservationResult==='created'}","href=\"/account/addresses\""])assert.ok(component.includes(marker),marker)
 assert.ok(component.includes("address_id:selectedAddress"))
 assert.ok(component.includes('payment_enabled!==false'))
})
