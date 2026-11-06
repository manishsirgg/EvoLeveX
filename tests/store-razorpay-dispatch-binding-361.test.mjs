import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('Store provider binding uses atomic claim then one POST and independent GET before correlation',async()=>{
 const binding=await read('src/lib/store-razorpay-dispatch-binding.ts')
 const core=await read('src/lib/store-provider-order-dispatch-core.ts')
 const adapter=await read('src/lib/store-razorpay-create-order.ts')
 const verifier=await read('src/lib/store-razorpay-provider-read.ts')
 for(const value of [
  "import 'server-only'",
  "STORE_RAZORPAY_PROVIDER_DISPATCH_ENABLED",
  "return dispatchStoreProviderOrderOnce(attempt,{",
  "claimForDispatch:persistence.claimForDispatch",
  "createProviderOrder:createStoreRazorpayProviderOrder",
  "readProviderOrder:async providerOrderId=>fetchVerifiedStoreProviderOrder({",
  "providerOrderId,receipt:attempt.receipt",
  "amount:attempt.amount,currency:attempt.currency",
  "correlateVerified:persistence.correlateVerified",
 ])assert.ok(binding.includes(value),value)
 assert.ok(binding.indexOf("STORE_RAZORPAY_PROVIDER_DISPATCH_ENABLED")<binding.indexOf('return dispatchStoreProviderOrderOnce('))
 assert.doesNotMatch(binding,/createClient\(|\.rpc\(|NextRequest|POST\(/)
 assert.ok(core.indexOf('await deps.claimForDispatch(attempt)')<core.indexOf('await deps.createProviderOrder(attempt,amount)'))
 assert.ok(core.indexOf('await deps.createProviderOrder(attempt,amount)')<core.indexOf('await deps.readProviderOrder(providerId)'))
 assert.ok(core.indexOf('await deps.readProviderOrder(providerId)')<core.indexOf('await deps.correlateVerified(attempt,verified)'))
 assert.ok(core.includes('STORE_DISPATCH_RECONCILIATION_REQUIRED'))
 assert.ok(adapter.includes("STORE_RAZORPAY_PROVIDER_DISPATCH_ENABLED"))
 assert.ok(verifier.includes("method: 'GET'"))
})
