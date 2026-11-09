import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('full-cart contract validates whole request, exact provider IDs and duplicate variants',async()=>{
 const c=await read('src/lib/printful/pod-full-cart-shipping-contract.ts')
 for(const x of [
  'validateFullCartPodShipping(',
  "lines.length===0||lines.length>50",
  'line.localVariantId.toLowerCase()',
  'local.has(id)||catalog.has(line.catalogVariantId)',
  "code:'DUPLICATE_VARIANT'",
  "totalQty>50",
  "code:'EXCESS_QUANTITY'",
  "destination.countryCode==='US'&&!state",
  "items:lines.map(v=>({variant_id:v.catalogVariantId,quantity:v.quantity}))",
 ])assert.ok(c.includes(x),x)
 assert.doesNotMatch(c,/fetch\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/)
})

test('gated Printful multi-line shipping capability has no fulfilment, payment or database access',async()=>{
 const c=await read('src/lib/printful/pod-full-cart-shipping.ts')
 for(const x of [
  "import 'server-only'",
  "STORE_POD_FULL_CART_SHIPPING_ENABLED",
  "PRINTFUL_STORE_ID!==STORE_ID",
  "validateFullCartPodShipping(destination,verifiedLines)",
  "'https://api.printful.com/shipping/rates'",
  "method:'POST'",
  "JSON.stringify(checked.request)",
  "AbortSignal.timeout(8000)",
  "root.result.length===0",
  "ids.has(v.id)",
  "lineCount:checked.request.items.length",
 ])assert.ok(c.includes(x),x)
 assert.ok(c.indexOf("STORE_POD_FULL_CART_SHIPPING_ENABLED")<c.indexOf('await fetch('))
 assert.ok(c.indexOf("validateFullCartPodShipping(destination,verifiedLines)")<c.indexOf('await fetch('))
 assert.doesNotMatch(c,/createClient\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\/orders\b|razorpay/i)
})
