import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { mapStoreProductVariantDatabaseError } from '../src/lib/admin-store-errors.ts'
import { parseStoreVariantMutation } from '../src/lib/admin-store-validation.ts'

const actions = await readFile(new URL('../src/app/admin/store/products/actions.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/app/admin/store/products/[id]/page.tsx', import.meta.url), 'utf8')
const manager = await readFile(new URL('../src/app/admin/store/products/product-variant-manager.tsx', import.meta.url), 'utf8')
const data = await readFile(new URL('../src/lib/admin-store.ts', import.meta.url), 'utf8')

test('variant parser normalizes the explicit identity whitelist', () => {
  assert.deepEqual(parseStoreVariantMutation({ sku: ' abc-1 ', size_code: ' m ', color_code: ' blue ', weight_g: '', sort_order: '0', price: '999' }), {
    success: true, data: { sku: 'ABC-1', size_code: 'M', color_code: 'BLUE', weight_g: null, sort_order: 0 },
  })
  assert.equal(parseStoreVariantMutation({ sku: 'A'.repeat(64), size_code: 'S'.repeat(32), color_code: '', weight_g: '1', sort_order: '2147483647' }).success, true)
  for (const sku of ['', '-BAD', 'BAD SPACE', 'A'.repeat(65)]) assert.equal(parseStoreVariantMutation({ sku, size_code: '', color_code: '', weight_g: '', sort_order: '0' }).success, false)
  for (const weight_g of ['0', '-1', '1.5', '2147483648', '9007199254740992']) assert.equal(parseStoreVariantMutation({ sku: 'SKU', size_code: '', color_code: '', weight_g, sort_order: '0' }).success, false)
  for (const sort_order of ['-1', '1.2', '2147483648']) assert.equal(parseStoreVariantMutation({ sku: 'SKU', size_code: '', color_code: '', weight_g: '', sort_order }).success, false)
})

test('editor preserves images and integrates archived-read-only variant manager', () => {
  assert.match(page, /<ProductImageManager/)
  assert.match(page, /getStoreAdminProductVariants\(id\)/)
  assert.match(page, /<ProductVariantManager/)
  assert.match(manager, /Archived product variants are read-only/)
  assert.match(manager, /!archived \? <button[^>]*[\s\S]*Add variant/)
  assert.doesNotMatch(manager, /Delete|Remove permanently/)
})

test('loader uses fixed batched dependency queries and deterministic ordering', () => {
  assert.match(data, /getStoreAdminProductVariants/)
  assert.match(data, /\.order\('sort_order'\)\.order\('created_at'\)\.order\('id'\)/)
  assert.match(data, /Promise\.all\(\[/)
  assert.match(data, /evo_store_variant_prices[\s\S]*pricesByVariant/)
  assert.match(data, /evo_store_inventory/)
  assert.doesNotMatch(data, /evo_store_variants[^\n]*price/)
})

test('all variant mutations independently authorize, verify parent and ownership', () => {
  for (const name of ['createStoreProductVariantAction', 'updateStoreProductVariantAction', 'setStoreProductVariantActiveState']) {
    assert.match(actions, new RegExp(`export async function ${name}[\\s\\S]*?await requireAdmin\\(\\)`))
  }
  assert.match(actions, /\.eq\('id', variantId\)\.eq\('product_id', productId\)/)
  assert.match(actions, /product_mode !== 'physical'/)
  assert.match(actions, /publication_status === 'archived'/)
  assert.match(actions, /typeof active !== 'boolean'/)
})

test('creation is inactive and compatibility price is server-only while update is whitelisted', () => {
  assert.match(actions, /const payload = \{ \.\.\.parsed\.data, product_id: productId, price: 0, is_active: false \}/)
  assert.deepEqual(actions.match(/\['sku', 'size_code', 'color_code', 'weight_g', 'sort_order'\]/)?.length, 1)
  for (const forbidden of ['currency', 'attributes', 'digital_file_path']) assert.doesNotMatch(actions, new RegExp(`formData\\.get\\('${forbidden}'\\)`))
  const variantActions = actions.slice(actions.indexOf('export async function createStoreProductVariantAction'), actions.indexOf('export async function createStoreVariantPriceAction'))
  assert.doesNotMatch(variantActions, /deleteStoreProductVariant|evo_store_variant_prices'\)\.insert|evo_store_inventory'\)\.insert/)
})

test('activation distinguishes draft from published dependencies and never unpublishes', () => {
  const activation = actions.slice(actions.indexOf('export async function setStoreProductVariantActiveState'), actions.indexOf('export async function createStoreProductAction'))
  assert.match(activation, /active && \(!owned\.variant\.weight_g/)
  assert.match(activation, /active && current\.product\.publication_status === 'published'/)
  assert.match(activation, /Configure inventory and an active price/)
  assert.doesNotMatch(activation, /publication_status: 'draft'/)
})

test('variant database errors are safely operation-specific', () => {
  assert.match(mapStoreProductVariantDatabaseError({ code: '23505', message: 'evo_store_variants_sku_key' }), /SKU is already in use/)
  assert.match(mapStoreProductVariantDatabaseError({ code: '23505', message: 'evo_store_variants_product_dimensions_key' }), /size and color/)
  assert.match(mapStoreProductVariantDatabaseError({ code: 'P0001', message: 'EVO_STORE_VARIANT_ARCHIVED_PRODUCT' }), /read-only/)
  assert.doesNotMatch(mapStoreProductVariantDatabaseError({ code: 'XX', message: 'SECRET SQL' }), /SECRET|SQL/)
})

test('variant application paths preserve cookie-backed RLS and avoid service role', () => {
  for (const source of [actions, data, manager]) assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service.?role/i)
  assert.match(actions, /createClient\(\)/)
})
