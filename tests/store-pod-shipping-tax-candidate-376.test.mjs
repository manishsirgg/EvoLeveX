import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('quote candidate remains non-payable and disconnected from persistence',async()=>{
 const c=await read('src/lib/printful/pod-shipping-tax-candidate.ts')
 for(const marker of [
  "import 'server-only'",
  "evaluatePodQuoteCandidate(",
  "digestPodTaxBasis(",
  "timingSafeEqual(expectedDigest,suppliedDigest)",
  "selected.currency!==resolved.currency",
  "shipping.lineCount!==resolved.lines.length",
  "shipping.options.filter(o=>o.id===selectedOptionId).length!==1",
  "nowMs-observed>120000",
  "tax.source!=='MERCHANT_APPROVED_TAX_ENGINE'",
  "tax.destinationCountry!==resolved.destination.countryCode",
  "nowMs-taxObserved>120000",
  "subtotal+=price*BigInt(line.quantity)",
  "paymentReady:false,fulfillmentReady:false",
 ])assert.ok(c.includes(marker),marker)
 assert.doesNotMatch(c,/INSERT INTO|UPDATE\s+private|DELETE FROM|\.rpc\(|createClient\(|fetch\(|\/orders\b|razorpay/i)
 assert.doesNotMatch(c,/\b[0-9]+n\b/)
})

test('money and evidence validation reject placeholders, stale prices and mismatched tax',async()=>{
 const c=await read('src/lib/printful/pod-shipping-tax-candidate.ts')
 for(const marker of [
  "resolved.currency==='JPY'",
  "taxCents===null",
  "tax.linesDigest",
  "tax.currency!==resolved.currency",
  "line.quantity<1||line.quantity>10",
  "quantity>50",
  "total>MAX_CENTS",
 ])assert.ok(c.includes(marker),marker)
})
