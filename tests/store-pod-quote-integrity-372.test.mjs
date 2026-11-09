import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261109210000_store_pod_quote_integrity.sql',import.meta.url),'utf8')

test('POD quote checks are transaction-deferred across header and line inserts',()=>{
 for(const term of [
  'create constraint trigger evo_store_pod_quote_header_integrity',
  'create constraint trigger evo_store_pod_quote_line_integrity',
  'deferrable initially deferred',
  'for update',
  'v_line_count < 1 or v_line_count > 50',
  'v_total <> v_quote.subtotal',
  'v_invalid <> 0',
  'STORE_POD_QUOTE_INTEGRITY_FAILED',
  'vm.sync_variant_id <> l.sync_variant_id',
  'vm.catalog_variant_id <> l.catalog_variant_id',
  "pm.sync_state <> 'synced'",
  "vm.sync_state <> 'synced'",
  'pm.store_id <> v_quote.printful_store_id',
  'v.sku <> l.sku',
 ])assert.ok(sql.includes(term),term)
 assert.equal((sql.match(/deferrable initially deferred/g)??[]).length,2)
})

test('POD quote evidence is immutable and cannot become payable or fulfilment-ready',()=>{
 for(const term of [
  'create trigger evo_store_pod_quote_header_immutability',
  'create trigger evo_store_pod_quote_line_immutability',
  "to_jsonb(new) - 'status'",
  "to_jsonb(old) - 'status'",
  "old.status = 'prepared' and new.status in ('expired','invalidated')",
  'STORE_POD_QUOTE_LINES_IMMUTABLE',
  'STORE_POD_QUOTE_HEADER_IMMUTABLE',
  'v_quote.payment_ready or v_quote.fulfillment_ready',
 ])assert.ok(sql.includes(term),term)
 assert.doesNotMatch(sql,/grant\s+(?:all|insert|update|delete|execute)\b/i)
 assert.doesNotMatch(sql,/\binsert into\b|\bupdate public\.|\bdelete from\b|\.com\/orders|razorpay/i)
})
