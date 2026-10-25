import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('staging worker binds actual restricted claim before provider POST',async()=>{
 const binding=await read('src/lib/store-staging-restricted-dispatch-binding.ts')
 const core=await read('src/lib/store-provider-order-dispatch-core.ts')
 assert.ok(binding.includes('executeAdmittedStagingStoreDispatch(config,operatorToken,attemptId'))
 assert.ok(binding.includes('claimForDispatch:attempt=>claimStoreDispatchWithRestrictedSession('))
 assert.ok(binding.includes('bindings.restrictedSession,bindings.restrictedLoginRole'))
 assert.ok(core.indexOf('await deps.claimForDispatch(attempt)')<core.indexOf('await deps.createProviderOrder(attempt,amount)'))
 assert.doesNotMatch(binding,/createClient\(|new Client\(|process\.env\.|fetch\(|createRazorpayOrder\(|service_role/)
})
test('staging restricted dispatch binding retains separately verified provider capabilities',async()=>{
 const binding=await read('src/lib/store-staging-restricted-dispatch-binding.ts')
 for(const cap of ['bindings.provider.createProviderOrder','bindings.provider.readProviderOrder',
  'bindings.provider.correlateVerified','verifyOperator:bindings.verifyOperator',
  'loadAttempt:bindings.loadAttempt'])
  assert.ok(binding.includes(cap),cap)
})
