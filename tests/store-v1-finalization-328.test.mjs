import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('merchant order finalization is triple-gated, authenticated and never starts payment',async()=>{
 const route=await read('src/app/api/store/checkout/finalize/route.ts')
 const migration=await read('supabase/migrations/20261014100000_store_merchant_financial_finalization.sql')
 for(const required of ["STORE_V1_FINALIZATION_UI_ENABLED!=='true'","STORE_V1_RESERVATION_UI_ENABLED!=='true'","STORE_RESERVATION_BRIDGE_ENABLED!=='true'","isSameOrigin(request)","supabase.auth.getUser()","rpc('finalize_evo_store_merchant_order'","payment_enabled:false","Cache-Control"])
   assert.ok(route.includes(required),required)
 assert.match(migration,/FUNCTION public\.finalize_evo_store_merchant_order\(p_checkout_id uuid\)/)
 assert.doesNotMatch(route,/createRazorpayOrder|reserve_razorpay_payment|fetchRazorpayPayment|PRINTFUL|service_role/)
})
test('customer checkout finalization is explicitly opt-in and still nonpaying',async()=>{
 const page=await read('src/app/(site)/store/checkout/page.tsx')
 const review=await read('src/components/store/store-checkout-review.tsx')
 assert.ok(page.includes("STORE_V1_FINALIZATION_UI_ENABLED === 'true'"))
 assert.ok(review.includes('/api/store/checkout/finalize'))
 assert.ok(review.includes("if(!reservationEnabled||!finalizationEnabled||!checkoutId||!quotePreview"))
 assert.ok(review.includes('payment_enabled!==false'))
 assert.ok(review.includes('Finalize order — no payment'))
 assert.match(review,/<button type="button" disabled/)
 assert.doesNotMatch(review,/razorpay\.open|createRazorpayOrder/)
})
