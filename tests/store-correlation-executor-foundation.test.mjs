import test from 'node:test'
import assert from 'node:assert/strict'
import {executeStoreCorrelationWithVerifiedContext} from '../src/lib/store-correlation-executor-foundation.ts'

const op='a1000000-0000-4000-8000-000000000001'
const attempt='a1000000-0000-4000-8000-000000000002'
const inp={operatorId:op,attemptId:attempt,orderId:'a1000000-0000-4000-8000-000000000003',intentId:'a1000000-0000-4000-8000-000000000004',receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',provider:{id:'order_12345678',receipt:'evs_1234567890abcdef1234567890abcdef',amount:2900,currency:'USD'}}
const ctx={operatorId:op,attemptId:attempt,nonce:'abcdef0123456789abcdef0123456789',issuedAtMs:1000000,verifiedAtMs:1000100}
const output={correlated:true,created:true,payment_ready:false,attempt_id:attempt,provider_order_id:'order_12345678'}
test('fresh trusted context permits only separately injected executor',async()=>{
 let count=0
 assert.deepEqual(await executeStoreCorrelationWithVerifiedContext(ctx,inp,async()=>{count++;return output},()=>1000200),output)
 assert.equal(count,1)
})
test('missing, mismatched and stale contexts fail before executor invocation',async()=>{
 let count=0
 const exec=async()=>{count++;return output}
 for(const bad of [{...ctx,operatorId:'bad'},{...ctx,attemptId:op},{...ctx,nonce:'short'}, {...ctx,verifiedAtMs:900000},{...ctx,verifiedAtMs:1000300}]){
  await assert.rejects(executeStoreCorrelationWithVerifiedContext(bad,inp,exec,()=>1000200))
 }
 assert.equal(count,0)
})
test('cannot equate correlation with captured payment',async()=>{
 await assert.rejects(executeStoreCorrelationWithVerifiedContext(ctx,inp,async()=>({...output,payment_ready:true}),()=>1000200),/RESULT_INVALID/)
})
