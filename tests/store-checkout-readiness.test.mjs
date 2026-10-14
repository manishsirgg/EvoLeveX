import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const src=new URL('../src/',import.meta.url)
test('checkout review never submits payment or claims inventory',async()=>{
 const component=await readFile(new URL('components/store/store-checkout-review.tsx',src),'utf8')
 assert.match(component,/\/api\/store\/cart\/resolve/)
 assert.match(component,/assessStoreCheckoutReadiness/)
 assert.match(component,/<button type="button" disabled/)
 assert.doesNotMatch(component,/createOrder|capturePayment|reserveInventory|razorpay\.open/)
})
test('checkout policy requires full eligibility and valid quantities',async()=>{
 const policy=await readFile(new URL('lib/store-checkout-readiness.ts',src),'utf8')
 for(const check of ['allLinesEligible','hasUnavailableLines','currency_mismatch','cart_summary_mismatch','invalid_quantity'])
   assert.ok(policy.includes(check),check)
})
