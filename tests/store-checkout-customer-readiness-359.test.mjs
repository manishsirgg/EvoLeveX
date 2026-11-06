import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('checkout exposes signed-in customer address readiness in pre-launch mode',async()=>{
 const page=await read('src/app/(site)/store/checkout/page.tsx')
 const view=await read('src/components/store/store-checkout-review.tsx')
 assert.ok(page.includes('let isSignedIn = false'))
 assert.ok(page.includes('isSignedIn = true'))
 assert.ok(page.includes('isSignedIn={isSignedIn}'))
 assert.ok(page.includes(".eq('user_id',user.id)"))
 assert.ok(view.includes('!isSignedIn?'))
 assert.ok(view.includes('/auth/login?next=%2Fstore%2Fcheckout'))
 assert.ok(view.includes("addresses.length===0?"))
 assert.ok(view.includes('selectedAddressDetails.full_name'))
 assert.ok(view.includes("!reservationEnabled?"))
 assert.ok(view.includes('Checkout reservations and payment remain unavailable.'))
 assert.ok(view.includes('disabled className="button-primary'))
})
