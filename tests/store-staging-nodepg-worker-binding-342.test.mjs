import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('admitted staging worker delegates atomic claim to actual Node pg adapter',async()=>{
 const code=await read('src/lib/store-staging-node-pg-worker-binding.ts')
 const driver=await read('src/lib/store-staging-node-pg-dispatch.ts')
 const core=await read('src/lib/store-provider-order-dispatch-core.ts')
 assert.ok(code.includes('executeAdmittedStagingStoreDispatch(config,operatorToken,attemptId'))
 assert.ok(code.includes('claimForDispatch:attempt=>claimStagingStoreDispatchWithNodePg('))
 assert.ok(code.includes('bindings.database.expectedLoginRole,bindings.database.secrets'))
 assert.ok(driver.includes('new Client(settings)'))
 assert.ok(core.indexOf('await deps.claimForDispatch(attempt)')<core.indexOf('await deps.createProviderOrder(attempt,amount)'))
 assert.doesNotMatch(code,/process\.env\.|fetch\(|createRazorpayOrder\(|GRANT EXECUTE|NEXT_PUBLIC_/)
})
test('provider capabilities remain explicitly external to worker Node pg binding',async()=>{
 const code=await read('src/lib/store-staging-node-pg-worker-binding.ts')
 for(const token of ['bindings.provider.createProviderOrder','bindings.provider.readProviderOrder','bindings.provider.correlateVerified','verifyOperator:bindings.verifyOperator','loadAttempt:bindings.loadAttempt'])assert.ok(code.includes(token),token)
})
