import test from 'node:test'
import assert from 'node:assert/strict'
import {recordVerifiedCorrelationViaRestrictedExecutor} from '../src/lib/store-provider-correlation-contract.ts'
const input={
 attemptId:'a1000000-0000-4000-8000-000000000001',
 orderId:'a1000000-0000-4000-8000-000000000002',
 intentId:'a1000000-0000-4000-8000-000000000003',
 operatorId:'a1000000-0000-4000-8000-000000000004',
 receipt:'evs_1234567890abcdef1234567890abcdef',
 amount:'29.00',currency:'USD',
 provider:{id:'order_12345678',receipt:'evs_1234567890abcdef1234567890abcdef',currency:'USD',amount:2900},
}
const good={correlated:true,created:true,payment_ready:false,attempt_id:input.attemptId,provider_order_id:input.provider.id}
test('requires valid provider evidence before invoking restricted executor',async()=>{
 let called=false
 await assert.rejects(recordVerifiedCorrelationViaRestrictedExecutor({...input,provider:{...input.provider,amount:2901}},async()=>{called=true;return good}),/EVIDENCE_MISMATCH/)
 assert.equal(called,false)
})
test('requires operator identity, provider id, and expected exact outcome',async()=>{
 await assert.rejects(recordVerifiedCorrelationViaRestrictedExecutor({...input,operatorId:'anonymous'},async()=>good),/IDENTITY_INVALID/)
 await assert.rejects(recordVerifiedCorrelationViaRestrictedExecutor(input,async()=>({...good,payment_ready:true})),/RESULT_INVALID/)
 await assert.rejects(recordVerifiedCorrelationViaRestrictedExecutor(input,async()=>({...good,provider_order_id:'order_87654321'})),/RESULT_INVALID/)
 assert.deepEqual(await recordVerifiedCorrelationViaRestrictedExecutor(input,async()=>good),good)
})
