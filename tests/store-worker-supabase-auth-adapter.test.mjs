import test from 'node:test'
import assert from 'node:assert/strict'
import {createStoreWorkerSupabaseAuthAdapter} from '../src/lib/store-worker-supabase-auth-adapter.ts'
test('rejects insecure or unsupported Supabase endpoint configurations',()=>{
 const role=async()=>false
 for(const url of ['http://project.supabase.co','https://evil.example.com','https://project.supabase.co.evil.test']){
  assert.throws(()=>createStoreWorkerSupabaseAuthAdapter(url,'a-publishable-key',role),/AUTH_CONFIG_INVALID/)
 }
 assert.throws(()=>createStoreWorkerSupabaseAuthAdapter('https://project.supabase.co','',role),/AUTH_CONFIG_INVALID/)
})
test('role authorization is explicitly delegated to a trusted fresh resolver',async()=>{
 let called=0
 const adapter=createStoreWorkerSupabaseAuthAdapter('https://project.supabase.co','a-publishable-key',async(id)=>{
  called++
  assert.equal(id,'operator-test')
  return false
 })
 assert.equal(await adapter.hasLiveReconciliationRole('operator-test'),false)
 assert.equal(called,1)
})
