import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('Store Razorpay intent claim is fully gated and never starts a payment',async()=>{
 const route=await read('src/app/api/store/checkout/claim-intent/route.ts')
 const sql=await read('supabase/migrations/20261015110000_store_razorpay_intent_claim.sql')
 for(const token of ["STORE_V1_INTENT_CLAIM_UI_ENABLED!=='true'","STORE_V1_PAYMENT_PREFLIGHT_UI_ENABLED!=='true'","STORE_V1_FINALIZATION_UI_ENABLED!=='true'","STORE_V1_RESERVATION_UI_ENABLED!=='true'","STORE_RESERVATION_BRIDGE_ENABLED!=='true'","isSameOrigin(request)","supabase.auth.getUser()","rpc('claim_evo_store_razorpay_intent'","provider_order_created:false","payment_ready:false"])assert.ok(route.includes(token),token)
 assert.match(sql,/FUNCTION public\.claim_evo_store_razorpay_intent\(p_order_id uuid,p_idempotency_key uuid\)/)
 assert.doesNotMatch(route,/createRazorpayOrder|reserve_razorpay_payment|attach_razorpay_order|service_role|PRINTFUL/)
})
test('checkout retries reuse the same claim idempotency key for the same pending order',async()=>{
 const page=await read('src/app/(site)/store/checkout/page.tsx')
 const review=await read('src/components/store/store-checkout-review.tsx')
 assert.ok(page.includes("STORE_V1_INTENT_CLAIM_UI_ENABLED === 'true'"))
 assert.ok(review.includes('/api/store/checkout/claim-intent'))
 assert.ok(review.includes("claimAttempt.current?.orderId!==finalOrder.order_id"))
 assert.ok(review.includes("preflightStatus!=='reviewed'"))
 assert.ok(review.includes('Reserve payment intent — no charge'))
 assert.match(review,/<button type="button" disabled/)
 assert.doesNotMatch(review,/razorpay\.open|createRazorpayOrder/)
})
