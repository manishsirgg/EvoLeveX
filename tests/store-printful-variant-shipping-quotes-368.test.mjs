import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('SKU-qualified Printful shipping quotes use trusted provider mapping and strict destination validation',async()=>{
 const quote=await read('src/lib/printful/verified-variant-shipping.ts')
 const action=await read('src/app/admin/store/products/tshirt-shipping-quote-action.ts')
 const page=await read('src/app/admin/store/products/[id]/page.tsx')
 const ui=await read('src/app/admin/store/products/tshirt-shipping-quote-control.tsx')
 for(const marker of [
  "PRINTFUL_VARIANT_SHIPPING_QUOTES_ENABLED",
  "getPrintfulProductDetail(PRODUCT_ID)",
  "reconcilePrintfulVariants(local,product)",
  "mapping.readyForMapping",
  "local.find(v=>v.id===input.localVariantId)",
  "matches.length!==1",
  "catalogVariantId:matches[0].catalogId",
  "validateShippingQuoteInput({",
  "method:'POST'",
  "'https://api.printful.com/shipping/rates'",
  "AbortSignal.timeout(8000)",
  "No retail total",
 ])assert.ok(quote.includes(marker),marker)
 assert.ok(quote.indexOf("PRINTFUL_VARIANT_SHIPPING_QUOTES_ENABLED")<quote.indexOf("getPrintfulProductDetail(PRODUCT_ID)"))
 assert.doesNotMatch(quote,/createClient\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\/orders\b/)
 assert.ok(action.indexOf("await requireAdmin()")<action.indexOf("db.from('evo_store_variants')"))
 assert.ok(action.includes(".eq('product_id',PRODUCT_ID)"))
 assert.ok(page.includes("enabled={process.env.PRINTFUL_VARIANT_SHIPPING_QUOTES_ENABLED === 'true'}"))
 assert.ok(ui.includes('window.confirm('))
 assert.ok(ui.includes('Inspect shipping options (no order)'))
})
