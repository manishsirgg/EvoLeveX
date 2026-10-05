import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { getStoreReadinessMessage, mapStoreProductDatabaseError } from '../src/lib/admin-store-errors.ts'
import { parseStoreProductMutation } from '../src/lib/admin-store-validation.ts'

const actions = await readFile(new URL('../src/app/admin/store/products/actions.ts', import.meta.url), 'utf8')
const dataAccess = await readFile(new URL('../src/lib/admin-store.ts', import.meta.url), 'utf8')
const listPage = await readFile(new URL('../src/app/admin/store/products/page.tsx', import.meta.url), 'utf8')
const newPage = await readFile(new URL('../src/app/admin/store/products/new/page.tsx', import.meta.url), 'utf8')
const editPage = await readFile(new URL('../src/app/admin/store/products/[id]/page.tsx', import.meta.url), 'utf8')
const form = await readFile(new URL('../src/app/admin/store/products/product-form.tsx', import.meta.url), 'utf8')

test('valid draft input is normalized into the exact product-core whitelist', () => {
  const result = parseStoreProductMutation({ name: '  Trail Shirt ', slug: ' Trail & Shirt ', category_id: '', description: ' Body ', short_description: ' Short ', is_featured: 'on', sort_order: '2', seo_title: ' SEO ', seo_description: ' Search ', publication_status: 'published', base_price: '99', currency: 'EUR', cover_image_url: 'bad', is_active: 'on', metadata: '{}', id: 'bad', created_at: 'bad', arbitrary: 'bad' })
  assert.deepEqual(result, { success: true, data: { name: 'Trail Shirt', slug: 'trail-shirt', category_id: null, description: 'Body', short_description: 'Short', is_featured: true, sort_order: 2, seo_title: 'SEO', seo_description: 'Search' } })
  if (result.success) for (const excluded of ['publication_status', 'product_mode', 'base_price', 'currency', 'cover_image_url', 'is_active', 'metadata', 'id', 'created_at', 'updated_at', 'arbitrary']) assert.equal(excluded in result.data, false)
})

test('product validation rejects empty names, invalid slugs, categories, and sort orders', () => {
  assert.equal(parseStoreProductMutation({ name: ' ', slug: 'ok', sort_order: '0' }).success, false)
  assert.equal(parseStoreProductMutation({ name: 'Name', slug: '!!!', sort_order: '0' }).success, false)
  assert.equal(parseStoreProductMutation({ name: 'Name', slug: 'name', category_id: 'bad', sort_order: '0' }).success, false)
  for (const sort_order of ['-1', '1.5', '', '9007199254740992']) assert.equal(parseStoreProductMutation({ name: 'Name', slug: 'name', sort_order }).success, false)
})

test('product failures and readiness codes map to safe messages', () => {
  assert.match(mapStoreProductDatabaseError({ code: '23505', message: 'secret constraint' }), /slug is already in use/i)
  assert.match(mapStoreProductDatabaseError({ code: '23503', message: 'secret row' }), /category is no longer available/i)
  assert.match(mapStoreProductDatabaseError({ code: 'P0001', message: 'EVO_STORE_READY_VARIANT_PRICE_REQUIRED' }), /price/i)
  const fallback = getStoreReadinessMessage('INTERNAL_SECRET')
  assert.doesNotMatch(fallback, /INTERNAL_SECRET/)
})

test('create and update payloads force lifecycle correctly and preserve strict whitelists', () => {
  assert.match(actions, /createPayload = \{ \.\.\.parsed\.data, product_mode: 'physical' as const, publication_status: 'draft' as const \}/)
  assert.match(actions, /\.update\(parsed\.data\)/)
  assert.doesNotMatch(actions, /update\(\{[^}]*publication_status: 'draft'/s)
})

test('readiness uses the existing advisory RPC without list fan-out', () => {
  assert.match(dataAccess, /\.rpc\('inspect_evo_store_product_readiness'/)
  assert.doesNotMatch(listPage, /inspectStoreAdminProductReadiness|inspect_evo_store_product_readiness/)
  assert.match(editPage, /Advisory snapshot only/)
})

test('publish and archive use qualified ordinary authenticated updates', () => {
  assert.match(actions, /update\(\{ publication_status: 'published' \}\).*\.eq\('publication_status', 'draft'\)/s)
  assert.match(actions, /update\(\{ publication_status: 'archived' \}\).*\.in\('publication_status', \['draft', 'published'\]\)/s)
  assert.doesNotMatch(actions, /service-role|serviceRole|createService|\.delete\s*\(|sql`|executeSql/i)
})

test('archived products are terminal in UI and every mutation is server-authorized', () => {
  assert.match(form, /Archived products are read-only and cannot be restored in the V1 admin/)
  assert.match(form, /disabled=\{archived\}/)
  assert.doesNotMatch(form, /Restore product|restoreStoreProductAction/)
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 4)
  assert.match(actions, /\.neq\('publication_status', 'archived'\)/)
  assert.equal((actions.match(/publication_status === 'archived'/g) ?? []).length, 3)
})

test('all product routes independently require admin access', () => {
  for (const page of [listPage, newPage, editPage]) assert.match(page, /await requireAdmin\(\)/)
})
