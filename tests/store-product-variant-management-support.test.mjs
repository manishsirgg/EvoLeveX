import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20261005020000_evo_store_product_variant_management_support.sql',
  import.meta.url,
)
const migration = await readFile(migrationUrl, 'utf8')

test('variant prerequisite targets the existing table with complete mutation coverage', () => {
  assert.match(migration, /before insert or update or delete on public\.evo_store_variants/i)
  assert.doesNotMatch(migration, /evo_store_product_variants/i)
  assert.doesNotMatch(migration, /create\s+table|alter\s+table|drop\s+table/i)
})

test('private guard is hardened and emits the stable archived-product error', () => {
  assert.match(migration, /function private\.guard_evo_store_archived_product_variants\(\)/i)
  assert.match(migration, /security definer\s+set search_path = ''/i)
  assert.match(migration, /publication_status\s*=\s*'archived'::public\.evo_store_publication_status/i)
  assert.match(migration, /errcode\s*=\s*'P0001'.*message\s*=\s*'EVO_STORE_VARIANT_ARCHIVED_PRODUCT'/i)
  assert.match(migration, /revoke all on function private\.guard_evo_store_archived_product_variants\(\)\s+from public, anon, authenticated/i)
})

test('guard locks old and new parents in deterministic order', () => {
  assert.match(migration, /tg_op <> 'INSERT'[\s\S]*old\.product_id/i)
  assert.match(migration, /tg_op <> 'DELETE'[\s\S]*new\.product_id/i)
  assert.match(migration, /from public\.evo_store_products product[\s\S]*order by product\.id\s+for update/i)
})

test('migration exposes no API and does not alter unrelated authority', () => {
  assert.doesNotMatch(migration, /function public\.|grant\s+execute|service_role/i)
  assert.doesNotMatch(migration, /readiness|disable\s+trigger|enable\s+row\s+level|create\s+policy|drop\s+policy/i)
  assert.doesNotMatch(migration, /evo_store_(?:variant_prices|inventory)/i)
})
