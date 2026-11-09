import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261109100000_store_pod_quote_foundation.sql',import.meta.url),'utf8')

test('POD quote foundation is private, nonpayable and no commerce enablement',()=>{
 for(const mark of [
  'create table private.evo_store_pod_quote_snapshots',
  'create table private.evo_store_pod_quote_lines',
  'references auth.users(id)',
  'destination_digest',
  "expires_at <= created_at + interval '15 minutes'",
  "status in ('prepared','expired','invalidated')",
  'payment_ready boolean not null default false check (payment_ready = false)',
  'fulfillment_ready boolean not null default false check (fulfillment_ready = false)',
  'unique (customer_id,idempotency_key)',
  'unique(quote_id,variant_id)',
  'references private.evo_store_printful_variant_maps(variant_id)',
  'generated always as (quantity * unit_price) stored',
  'enable row level security',
 ])assert.ok(sql.includes(mark),mark)
 assert.equal((sql.match(/enable row level security/g)??[]).length,2)
 assert.equal((sql.match(/revoke all on private\.evo_store_pod_quote_/g)??[]).length,2)
 assert.doesNotMatch(sql,/grant\s+(?:all|select|insert|update|delete|execute)\b/i)
 assert.doesNotMatch(sql,/\bcreate\s+(?:or\s+replace\s+)?function\b|\bcreate\s+trigger\b|\bupdate\s+public\.|\binsert\s+into\s+public\.|printful\.com|razorpay\.com/i)
})
test('POD quote foreign keys bind mapped product identity without faking stock',()=>{
 for(const mark of [
  'foreign key (quote_id,printful_store_id)',
  'foreign key (product_map_id,product_id)',
  'foreign key (variant_id,product_id)',
  'sync_variant_id text not null',
  'catalog_variant_id text not null',
  'quantity integer not null check (quantity between 1 and 10)',
  'unit_price numeric(14,2) not null check (unit_price > 0)',
 ])assert.ok(sql.includes(mark),mark)
 assert.doesNotMatch(sql,/quantity_on_hand|quantity_reserved|evo_store_inventory|publication_status\s*=|is_active\s*=/i)
})
