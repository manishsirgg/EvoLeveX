import test from 'node:test'
import assert from 'node:assert/strict'
import {establishStoreOperatorBinding,revalidateStoreOperatorBinding} from '../src/lib/store-worker-operator-binding.ts'
const id='a1000000-0000-4000-8000-000000000001'
const second='a1000000-0000-4000-8000-000000000002'
const token='test-isolated-bearer-token'
const deps={verifySession:async()=>({id,emailConfirmed:true}),hasLiveReconciliationRole:async()=>true}
test('binds only independently authenticated operator, not request metadata',async()=>{
 const binding=await establishStoreOperatorBinding(token,deps)
 assert.equal(binding.operatorId,id)
 assert.notEqual(binding.tokenFingerprint,token)
 assert.equal(Object.isFrozen(binding),true)
 assert.equal(await revalidateStoreOperatorBinding(binding,token,deps),id)
})
test('rejects changed token without contacting identity service',async()=>{
 const binding=await establishStoreOperatorBinding(token,deps)
 let calls=0
 await assert.rejects(revalidateStoreOperatorBinding(binding,'another-isolated-bearer-token',{...deps,verifySession:async()=>{calls++;return {id,emailConfirmed:true}}}),/TOKEN_CHANGED/)
 assert.equal(calls,0)
})
test('rejects identity swap, revoked role and authentication outage at revalidation',async()=>{
 const binding=await establishStoreOperatorBinding(token,deps)
 await assert.rejects(revalidateStoreOperatorBinding(binding,token,{...deps,verifySession:async()=>({id:second,emailConfirmed:true})}),/IDENTITY_CHANGED/)
 await assert.rejects(revalidateStoreOperatorBinding(binding,token,{...deps,hasLiveReconciliationRole:async()=>false}),/OPERATOR_FORBIDDEN/)
 await assert.rejects(revalidateStoreOperatorBinding(binding,token,{...deps,verifySession:async()=>{throw Error('unavailable')}}),/SESSION_UNVERIFIED/)
})
test('malformed binding fails closed',async()=>{
 await assert.rejects(revalidateStoreOperatorBinding({operatorId:id,tokenFingerprint:'wrong'},token,deps),/BINDING_INVALID/)
})
