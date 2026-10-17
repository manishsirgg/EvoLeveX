import test from 'node:test'
import assert from 'node:assert/strict'
import {authenticateStoreWorkerOperator} from '../src/lib/store-worker-operator-identity.ts'
const id='a1000000-0000-4000-8000-000000000001',token='test-isolated-bearer-token'
const good={verifySession:async()=>({id,emailConfirmed:true}),hasLiveReconciliationRole:async()=>true}
test('requires a verified user and fresh authorization',async()=>assert.equal(await authenticateStoreWorkerOperator(token,good),id))
test('invalid token is rejected before any external work',async()=>{
 let calls=0
 await assert.rejects(authenticateStoreWorkerOperator('bad',{verifySession:async()=>{calls++;return null},hasLiveReconciliationRole:async()=>true}),/SESSION_INVALID/)
 assert.equal(calls,0)
})
test('denies unverified, unconfirmed, revoked and unreachable roles',async()=>{
 for(const deps of [
  {...good,verifySession:async()=>null},
  {...good,verifySession:async()=>({id,emailConfirmed:false})},
  {...good,verifySession:async()=>{throw Error('outage')}},
  {...good,hasLiveReconciliationRole:async()=>false},
  {...good,hasLiveReconciliationRole:async()=>{throw Error('outage')}},
 ]){
  await assert.rejects(authenticateStoreWorkerOperator(token,deps),/STORE_WORKER_/)
 }
})
