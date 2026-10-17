import test from 'node:test'
import assert from 'node:assert/strict'
import {runIsolatedStoreCorrelationProtocol} from '../src/lib/store-isolated-correlation-protocol.ts'
const attemptId='a1000000-0000-4000-8000-000000000001',operatorId='a1000000-0000-4000-8000-000000000002'
const attempt={attemptId,orderId:'a1000000-0000-4000-8000-000000000003',intentId:'a1000000-0000-4000-8000-000000000004',receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',state:'dispatch_uncertain'}
const evidence={id:'order_12345678',receipt:attempt.receipt,amount:2900,currency:'USD'}
const result={correlated:true,created:true,payment_ready:false,attempt_id:attemptId,provider_order_id:evidence.id}
function setup(changes={}){
 const calls=[]
 return {calls,deps:{
 authenticateOperator:async()=>{calls.push('auth');return operatorId},
 authorizeOperator:async()=>{calls.push('authz');return true},
 loadAttempt:async()=>{calls.push('load');return attempt},
 discover:async()=>{calls.push('discover');return evidence},
 verify:async()=>{calls.push('verify');return evidence},
 execute:async()=>{calls.push('execute');return result},
 now:()=>1000000,nonce:()=> 'abcdef0123456789abcdef0123456789',
 ...changes,
 }}
}
test('rechecks operator and attempt after external provider reads',async()=>{
 const {calls,deps}=setup()
 assert.deepEqual(await runIsolatedStoreCorrelationProtocol(attemptId,deps),result)
 assert.deepEqual(calls,['auth','authz','load','discover','verify','authz','load','execute'])
})
test('revocation rejects execution',async()=>{
 let n=0
 const {deps,calls}=setup({authorizeOperator:async()=>++n===1})
 await assert.rejects(runIsolatedStoreCorrelationProtocol(attemptId,deps),/REVOKED/)
 assert.ok(!calls.includes('execute'))
})
test('stale attempt and invalid evidence reject execution',async()=>{
 let n=0
 const stale=setup({loadAttempt:async()=>++n===1?attempt:{...attempt,amount:'30.00'}})
 await assert.rejects(runIsolatedStoreCorrelationProtocol(attemptId,stale.deps),/CHANGED/)
 const bad=setup({verify:async()=>({...evidence,amount:2901})})
 await assert.rejects(runIsolatedStoreCorrelationProtocol(attemptId,bad.deps),/MISMATCH/)
 assert.ok(!bad.calls.includes('execute'))
})
