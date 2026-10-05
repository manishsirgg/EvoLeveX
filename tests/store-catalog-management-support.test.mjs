import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/20261005000000_evo_store_catalog_management_support.sql', import.meta.url)
const migration = await readFile(migrationUrl, 'utf8')

test('Store management functions are hardened and narrowly granted', () => {
  for (const signature of [
    'inspect_evo_store_product_readiness(uuid)',
    'adjust_evo_store_inventory(uuid, text, integer, text)',
    'get_evo_store_variant_availability(uuid[])',
  ]) assert.match(migration, new RegExp(`revoke all on function public\\.${signature.replace(/[()[\]]/g, '\\$&')}`))
  assert.equal((migration.match(/security definer/g) ?? []).length, 3)
  assert.equal((migration.match(/set search_path = ''/g) ?? []).length, 3)
  assert.match(migration, /grant execute on function public\.get_evo_store_variant_availability\(uuid\[\]\) to anon, authenticated/)
  assert.doesNotMatch(migration, /grant execute on function public\.adjust_evo_store_inventory[^;]+anon/)
})

test('inventory RPC owns mutation and movement attribution', () => {
  assert.match(migration, /for update/)
  assert.match(migration, /created_by\)\s+values \(p_variant_id, movement_delta, p_reason, auth\.uid\(\)\)/)
  assert.match(migration, /movement_delta <> 0/)
  assert.match(migration, /resulting stock cannot be below reserved stock/)
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger on table public\.evo_store_inventory from authenticated/)
})

test('public availability exposes labels rather than inventory quantities', () => {
  const availability = migration.slice(migration.indexOf('create or replace function public.get_evo_store_variant_availability'))
  assert.match(availability, /returns table \(variant_id uuid, availability text\)/)
  assert.match(availability, /'in_stock'/)
  assert.match(availability, /'out_of_stock'/)
  assert.match(availability, /'unavailable'/)
  assert.doesNotMatch(availability, /returns table[\s\S]{0,200}quantity_on_hand/)
})
