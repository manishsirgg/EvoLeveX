import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('authoritative POD input resolver is disconnected and read-only',async()=>{
 const source=await read('src/lib/printful/pod-authoritative-input-resolver.ts')
 for(const marker of [
  "import 'server-only'",
  "const ROLE='evo_store_pod_quote_reader'",
  "SELECT current_user AS principal, session_user AS login",
  "role.rows[0].principal!==ROLE",
  "role.rows[0].login!==ROLE",
  "FROM public.addresses",
  "id=$1::uuid AND user_id=$2::uuid",
  "FROM public.evo_store_variants v",
  "JOIN private.evo_store_printful_variant_maps vm",
  "JOIN private.evo_store_printful_product_maps pm",
  "JOIN public.evo_store_variant_prices price",
  "s.external_store_id=$3::text AND s.sync_enabled=true",
  "row.product_sync!=='synced'||row.variant_sync!=='synced'",
  "row.publication_status!=='published'",
  "row.variant_active!==true",
  "row.price_active!==true",
  "validateFullCartPodShipping(destination,shippingLines)",
 ])assert.ok(source.includes(marker),marker)
 assert.doesNotMatch(source,/INSERT INTO|UPDATE\s+public|DELETE FROM|\.rpc\(|createClient\(|fetch\(|\/orders\b|razorpay|STORE_RESERVATION_BRIDGE_ENABLED/i)
 assert.ok(source.indexOf("role.rows[0].login!==ROLE")<source.indexOf("FROM public.addresses"))
})
test('full cart line quantities, duplicates, store identity and weight are rejected',async()=>{
 const source=await read('src/lib/printful/pod-authoritative-input-resolver.ts')
 for(const marker of [
  "variants.has(id)",
  "totalQty>50",
  "rows.rows.length!==input.items.length",
  "resolved.has(key)",
  "Number.isSafeInteger(row.weight_g)",
  "Number.isSafeInteger(v.catalogVariantId)",
  "row.product_mode!=='physical'",
 ])assert.ok(source.includes(marker),marker)
})
