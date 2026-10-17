import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyStoreWorkerOperatorLive,createStoreWorkerTokenBoundClient} from '../src/lib/store-worker-live-role-adapter.ts'
const operator='a1000000-0000-4000-8000-000000000001'
const token='test-token-for-mocked-worker'
function fixture({authorized=true,revoke=false,wrongUser=false,error=false}={}){
 let reads=0,checks=0
 const client={
  auth:{getUser:async()=>{reads++;return {data:{user:{id:wrongUser&&reads===2?'a1000000-0000-4000-8000-000000000002':operator,email_confirmed_at:'2026-01-01'}},error:null}}},
  rpc:async(name)=>{checks++;assert.equal(name,'can_operate_evo_store_reconciliation');return {data:authorized&&!revoke,error:error?'unavailable':null}},
 }
 return {client,stats:()=>({reads,checks})}
}
test('fresh JWT-bound role RPC permits authorized operator',async()=>{
 const {client,stats}=fixture()
 assert.equal(await verifyStoreWorkerOperatorLive(token,()=>client),operator)
 assert.deepEqual(stats(),{reads:2,checks:1})
})
test('revocation, role RPC errors and identity changes fail closed',async()=>{
 for(const options of [{authorized:false},{revoke:true},{error:true},{wrongUser:true}]){
  const {client}=fixture(options)
  await assert.rejects(verifyStoreWorkerOperatorLive(token,()=>client),/STORE_WORKER_OPERATOR_FORBIDDEN/)
 }
})
test('rejects insecure configuration and never needs service-role credential',()=>{
 assert.throws(()=>createStoreWorkerTokenBoundClient('http://example.supabase.co','publishable-key',token),/ROLE_CONFIG_INVALID/)
})
