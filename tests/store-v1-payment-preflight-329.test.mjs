import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('Store payment preflight is strictly gated, authenticated and never charges',async()=>{
 const route=await read('src/app/api/store/checkout/payment-preflight/route.ts')
 const sql=await read('supabase/migrations/20261015100000_store_payment_preflight.sql')
 for(const token of ["STORE_V1_PAYMENT_PREFLIGHT_UI_ENABLED!=='true'","STORE_V1_FINALIZATION_UI_ENABLED!=='true'","STORE_V1_RESERVATION_UI_ENABLED!=='true'","STORE_RESERVATION_BRIDGE_ENABLED!=='true'","isSameOrigin(request)","supabase.auth.getUser()","rpc('preflight_evo_store_payment'","payment_ready:false","requires_provider_capability_check:true"])assert.ok(route.includes(token),token)
 assert.match(sql,/FUNCTION public\.preflight_evo_store_payment\(p_order_id uuid\)/)
 assert.doesNotMatch(route,/createRazorpayOrder|reserve_razorpay_payment|attach_razorpay_order|service_role|PRINTFUL/)
})
test('Store checkout preflight is opt-in and payment remains disabled',async()=>{
 const page=await read('src/app/(site)/store/checkout/page.tsx')
 const review=await read('src/components/store/store-checkout-review.tsx')
 assert.ok(page.includes("STORE_V1_PAYMENT_PREFLIGHT_UI_ENABLED === 'true'"))
 assert.ok(review.includes('/api/store/checkout/payment-preflight'))
 assert.ok(review.includes('Check payment readiness — no charge'))
 assert.ok(review.includes('p.payment_ready!==false'))
 assert.match(review,/<button type="button" disabled/)
 assert.doesNotMatch(review,/razorpay\.open|createRazorpayOrder/)
})
