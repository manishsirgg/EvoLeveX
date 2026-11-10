import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('full-cart shipping evidence is created from the exact trusted provider request',async()=>{
 const code=await read('src/lib/printful/pod-shipping-request-binding.ts')
 for(const marker of [
  "import 'server-only'",
  "validateFullCartPodShipping(",
  "source.quantity!==line.quantity",
  "source.catalogVariantId!==String(line.catalogVariantId)",
  "requestBoundPodShipping(",
  "quoteFullCartPodShipping(",
  "resolved.destination,resolved.shippingLines",
  "shipping.lineCount!==resolved.shippingLines.length",
  "requestDigest:binding.digest,responseDigest",
  "provider",
  "verifyBoundPodShipping(",
  "matchesDigest(request.digest,evidence.requestDigest)",
  "matchesDigest(currentResponse,evidence.responseDigest)",
  "nowMs-observed>MAX_QUOTE_AGE_MS",
  "evaluateBoundPodQuoteCandidate(",
  "evaluatePodQuoteCandidate(resolved,evidence.shipping",
 ])assert.ok(code.includes(marker),marker)
 assert.ok(code.indexOf('requestBinding(resolved)')<code.indexOf('await quoteFullCartPodShipping('))
 assert.doesNotMatch(code,/createClient\(|createAdminClient\(|new Client\(|INSERT INTO|UPDATE\s+private|DELETE FROM|\.rpc\(|\/orders\b|razorpay|process\.env/i)
 assert.doesNotMatch(code,/\b\d+n\b/)
})

test('shipping correlation is not misrepresented as authentication or permission to charge',async()=>{
 const code=await read('src/lib/printful/pod-shipping-request-binding.ts')
 assert.match(code,/NOT a signature/)
 assert.match(code,/untrusted JSON can forge/)
 assert.match(code,/does not make the candidate persistable\/payable/)
 assert.ok(code.includes("return {ok:false,code:'SHIPPING_UNAVAILABLE'}"))
})
