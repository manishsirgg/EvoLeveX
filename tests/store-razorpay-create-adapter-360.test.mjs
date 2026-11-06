import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('Store Razorpay order POST capability is disabled, validated and not retryable',async()=>{
 const adapter=await read('src/lib/store-razorpay-create-order.ts')
 const dispatcher=await read('src/lib/store-provider-order-dispatch-core.ts')
 const provider=await read('src/lib/razorpay.ts')
 for(const required of [
  "import 'server-only'","STORE_RAZORPAY_PROVIDER_DISPATCH_ENABLED",
  "STORE_PROVIDER_DISPATCH_DISABLED","attempt.state!=='prepared'",
  'parseTrustedStoreAmount(attempt.amount,attempt.currency)',
  'amountSubunits!==verifiedSubunits','isSupportedCurrency(attempt.currency)',
  'createRazorpayOrder({','orderId:attempt.orderId,paymentId:attempt.intentId',
 ])assert.ok(adapter.includes(required),required)
 assert.ok(adapter.indexOf("STORE_RAZORPAY_PROVIDER_DISPATCH_ENABLED")<adapter.indexOf("createRazorpayOrder({"))
 assert.doesNotMatch(adapter,/\.rpc\(|setTimeout\(|for\s*\(|while\s*\(|createClient\(/)
 assert.ok(dispatcher.includes('claimForDispatch:(attempt:TrustedStoreDispatchAttempt)=>Promise<boolean>'))
 assert.ok(dispatcher.includes('const claimed=await deps.claimForDispatch(attempt)'))
 assert.ok(dispatcher.indexOf('const claimed=await deps.claimForDispatch(attempt)')<dispatcher.indexOf('await deps.createProviderOrder(attempt,amount)'))
 assert.ok(provider.includes('if (!response.ok) throw new RazorpayRequestError(false)'))
})
