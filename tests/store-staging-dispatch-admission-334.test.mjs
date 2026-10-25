import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('staging dispatch verifies admission and operator before reading attempt or dispatching',async()=>{
 const code=await read('src/lib/store-staging-admitted-dispatch.ts')
 const gate=code.indexOf('assertStoreWorkerAdmission(config)')
 const identity=code.indexOf('await bindings.verifyOperator(operatorToken)')
 const load=code.indexOf('await bindings.loadAttempt(attemptId,operatorId)')
 const dispatch=code.indexOf('return dispatchStoreProviderOrderOnce(trusted,bindings.dependencies)')
 assert.ok(gate>=0&&gate<identity&&identity<load&&load<dispatch)
 assert.ok(code.includes("trusted.attemptId!==attemptId||trusted.state!=='prepared'"))
 assert.ok(code.includes('STORE_STAGING_DISPATCH_OPERATOR_INVALID'))
 assert.doesNotMatch(code,/createRazorpayOrder\(|fetch\(|process\.env\.|createServiceRoleClient|service_role/)
})
test('staging dispatch admission is staging-only and demands payment gates closed',async()=>{
 const code=await read('src/lib/store-worker-admission.ts')
 for(const clause of ["config.environment!=='staging'","config.storeBridgeEnabled!=='false'",
  "config.paymentCaptureEnabled!=='false'","config.printfulFulfillmentEnabled!=='false'",
  "config.runtime!=='isolated-worker'","config.credentialSource!=='dedicated-secret-manager'"])
  assert.ok(code.includes(clause),clause)
})
