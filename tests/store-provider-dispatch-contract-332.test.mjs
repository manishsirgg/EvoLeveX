import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('Store provider-order dispatcher requires pre-POST claim, verified GET and correlation',async()=>{
 const code=await read('src/lib/store-provider-order-dispatch-core.ts')
 const claim=code.indexOf('await deps.claimForDispatch(attempt)')
 const post=code.indexOf('await deps.createProviderOrder(attempt,amount)')
 const get=code.indexOf('await deps.readProviderOrder(providerId)')
 const verify=code.indexOf('verifyStoreProviderOrderEvidence({')
 const correlate=code.indexOf('await deps.correlateVerified(attempt,verified)')
 assert.ok(claim>0&&claim<post&&post<get&&get<verify&&verify<correlate)
 for(const guard of ["claimed!==true","STORE_DISPATCH_RECONCILIATION_REQUIRED",
  "correlation.payment_ready!==false","correlation.provider_order_id!==providerId",
  "STORE_DISPATCH_NOT_CLAIMED"]) assert.ok(code.includes(guard),guard)
 assert.doesNotMatch(code,/createRazorpayOrder\(|fetch\(|process\.env\.|supabase\.rpc\(|setTimeout\(/)
})
test('provider-order dispatch contract cannot itself enable customer payments or fulfillment',async()=>{
 const code=await read('src/lib/store-provider-order-dispatch-core.ts')
 assert.ok(code.includes("state:'prepared'"))
 assert.ok(code.includes('paymentReady:false'))
 assert.doesNotMatch(code,/capturePayment|reserve_razorpay_payment|fulfill_confirmed|PRINTFUL|service_role/)
})
