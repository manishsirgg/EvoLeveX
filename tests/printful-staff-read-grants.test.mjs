import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../supabase/migrations/20261011050000_printful_staff_inventory_storage_read.sql', import.meta.url)

test('Inventory grant preserves existing staff RLS boundary', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /GRANT SELECT ON TABLE public\.evo_store_inventory TO authenticated/)
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY|GRANT ALL|TO anon/)
})
test('Storage read is limited to staff and known product images', async () => {
  const sql = await readFile(migration, 'utf8')
  assert.match(sql, /FOR SELECT\s+TO authenticated/)
  assert.match(sql, /private\.is_staff\(\)/)
  assert.match(sql, /bucket_id = 'evo-store-products'/)
  assert.match(sql, /public\.evo_store_product_images/)
  assert.match(sql, /image\.storage_path = storage\.objects\.name/)
  assert.doesNotMatch(sql, /FOR (?:INSERT|UPDATE|DELETE)/)
})
