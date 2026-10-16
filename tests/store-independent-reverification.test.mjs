import test from 'node:test'
import assert from 'node:assert/strict'
import {checkIndependentRecoveryEvidence} from '../src/lib/store-razorpay-reverification-core.ts'
import {readFile} from 'node:fs/promises'
const expected={attemptId:'a',orderId:'b',intentId:'c',receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',state:'dispatch_uncertain'}
const evidence={id:'order_12345678',receipt:expected.receipt,amount:2900,currency:'USD'}
test('independent GET agrees with discovery and trusted amount',()=>{
 assert.doesNotThrow(()=>checkIndependentRecoveryEvidence(expected,evidence,{...evidence}))
})
test('independent GET detects provider conflict or amount mismatch',()=>{
 for(const bad of [{...evidence,id:'order_87654321'},{...evidence,amount:2901},
   {...evidence,receipt:'evs_abcdef0123456789abcdef0123456789'},
   {...evidence,currency:'INR'}]){
   assert.throws(()=>checkIndependentRecoveryEvidence(expected,evidence,bad),/MISMATCH/)
 }
 assert.throws(()=>checkIndependentRecoveryEvidence({...expected,state:'prepared'},evidence,evidence),/STATE_INVALID/)
})
test('closed server path requires an audited fresh read after provider GET',async()=>{
 const s=await readFile(new URL('../src/lib/store-razorpay-reverify-uncertain.ts',import.meta.url),'utf8')
 assert.match(s,/import 'server-only'/)
 assert.match(s,/fetchUniqueStoreOrderByTrustedReceipt/)
 assert.match(s,/fetchVerifiedStoreProviderOrder/)
 assert.equal(s.match(/loadAuthorizedUncertainStoreAttempt\(attemptId\)/g)?.length,2)
 assert.match(s,/paymentReady:false as const,correlationAuthorized:false as const/)
 assert.doesNotMatch(s,/\.rpc\(|\.insert\(|\.update\(|export (?:async )?function (?:GET|POST)/)
})
