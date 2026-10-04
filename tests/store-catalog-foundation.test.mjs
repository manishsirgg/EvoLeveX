import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/20261004000000_evo_store_catalog_foundation.sql', import.meta.url)
const migration = await readFile(migrationUrl, 'utf8')

test('Store publication has one authoritative lifecycle and a compatibility projection', () => {
  assert.match(migration, /create type public\.evo_store_publication_status as enum \('draft', 'published', 'archived'\)/)
  assert.match(migration, /new\.is_active := new\.publication_status = 'published'/)
  assert.match(migration, /evo_store_products_is_active_projection_check/)
  assert.match(migration, /create constraint trigger evo_store_products_readiness[\s\S]*deferrable initially deferred/)
})

test('Store variants and configured prices use normalized authoritative invariants', () => {
  assert.match(migration, /upper\(pg_catalog\.btrim\(new\.sku\)\)/)
  assert.match(migration, /sku ~ '\^\[A-Z0-9\]\[A-Z0-9\._\/-\]\{0,63\}\$'/)
  assert.match(migration, /unique nulls not distinct \(product_id, size_code, color_code\)/)
  assert.match(migration, /create table public\.evo_store_variant_prices/)
  assert.match(migration, /currency <> 'JPY' or amount = trunc\(amount\)/)
  assert.match(migration, /price\.is_active and price\.amount > 0/)
  assert.doesNotMatch(migration, /update public\.evo_store_variants\s+set\s+price/i)
  assert.doesNotMatch(migration, /update public\.evo_store_products\s+set\s+base_price/i)
})

test('Store images remain private and public object reads are publication-scoped', () => {
  assert.match(migration, /'evo-store-products',[\s\S]*false,[\s\S]*array\['image\/jpeg', 'image\/png', 'image\/webp', 'image\/avif'\]/)
  assert.match(migration, /storage_path ~ \('\^' \|\| product_id::text/)
  assert.ok(migration.includes("{12}\\.(jpg|jpeg|png|webp|avif)$'"), 'SQL regex uses one backslash to escape the extension dot')
  assert.ok(!migration.includes("{12}\\\\.(jpg|jpeg|png|webp|avif)$'"), 'SQL regex does not require a literal backslash in object paths')
  assert.match(migration, /create policy evo_store_product_objects_public_read on storage\.objects[\s\S]*product\.publication_status = 'published'/)
  assert.doesNotMatch(migration, /values\s*\([\s\S]{0,100}'evo-store-products'[\s\S]{0,100}true/i)
})

test('Store readiness covers every child table that can invalidate publication', () => {
  for (const trigger of [
    'evo_store_categories_readiness',
    'evo_store_product_images_readiness',
    'evo_store_variants_readiness',
    'evo_store_variant_prices_readiness',
    'evo_store_inventory_readiness',
  ]) {
    assert.match(migration, new RegExp(`create constraint trigger ${trigger}[\\s\\S]*?deferrable initially deferred`))
  }
  for (const code of [
    'EVO_STORE_READY_PHYSICAL_REQUIRED',
    'EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED',
    'EVO_STORE_READY_IMAGE_REQUIRED',
    'EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED',
    'EVO_STORE_READY_ACTIVE_VARIANT_REQUIRED',
    'EVO_STORE_READY_VARIANT_WEIGHT_REQUIRED',
    'EVO_STORE_READY_VARIANT_INVENTORY_REQUIRED',
    'EVO_STORE_READY_VARIANT_PRICE_REQUIRED',
  ]) assert.match(migration, new RegExp(code))
})
