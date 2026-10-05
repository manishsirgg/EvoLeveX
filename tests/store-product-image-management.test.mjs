import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

import { mapStoreProductImageDatabaseError } from '../src/lib/admin-store-errors.ts'
import { parseStoreProductImageFile, parseStoreProductImageMetadata, STORE_PRODUCT_IMAGE_MAX_BYTES } from '../src/lib/admin-store-validation.ts'

const actions = await readFile(new URL('../src/app/admin/store/products/actions.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/app/admin/store/products/[id]/page.tsx', import.meta.url), 'utf8')
const manager = await readFile(new URL('../src/app/admin/store/products/product-image-manager.tsx', import.meta.url), 'utf8')
const upload = await readFile(new URL('../src/app/admin/store/products/product-image-upload.tsx', import.meta.url), 'utf8')
const card = await readFile(new URL('../src/app/admin/store/products/product-image-card.tsx', import.meta.url), 'utf8')
const dataAccess = await readFile(new URL('../src/lib/admin-store.ts', import.meta.url), 'utf8')

test('image file validation supports the bucket formats and exact size boundary', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) {
    const extension = type === 'image/jpeg' ? 'jpg' : type.slice('image/'.length)
    assert.equal(parseStoreProductImageFile({ name: `image.${extension}`, type, size: STORE_PRODUCT_IMAGE_MAX_BYTES }).success, true)
  }
  assert.equal(parseStoreProductImageFile({ name: 'image.jpeg', type: 'image/jpeg', size: 1 }).success, true)
  assert.equal(parseStoreProductImageFile({ name: 'image.gif', type: 'image/gif', size: 1 }).success, false)
  assert.equal(parseStoreProductImageFile({ name: 'image.jpg', type: 'image/jpeg', size: STORE_PRODUCT_IMAGE_MAX_BYTES + 1 }).success, false)
  assert.equal(parseStoreProductImageFile({ name: 'image.jpg', type: 'image/jpeg', size: 0 }).success, false)
  assert.equal(parseStoreProductImageFile({ name: 'image.JPG', type: 'IMAGE/JPEG', size: 1 }).success, true)
  assert.equal(parseStoreProductImageFile({ name: 'image.png', type: 'image/jpeg', size: 1 }).success, false)
  assert.equal(parseStoreProductImageFile({ name: 'image.jpeg', type: 'image/jpeg', size: 1 }).extension, 'jpg')
})

test('metadata normalization trims nullable alt text and validates sort order', () => {
  assert.deepEqual(parseStoreProductImageMetadata({ altText: '  detail  ', sortOrder: '4' }), { success: true, altText: 'detail', sortOrder: 4 })
  assert.deepEqual(parseStoreProductImageMetadata({ altText: '  ', sortOrder: '0' }), { success: true, altText: null, sortOrder: 0 })
  for (const sortOrder of ['-1', '1.2', '', '9007199254740992']) assert.equal(parseStoreProductImageMetadata({ altText: '', sortOrder }).success, false)
  assert.equal(parseStoreProductImageMetadata({ altText: 'x'.repeat(501), sortOrder: '0' }).success, false)
})

test('editor embeds deterministic private image management and archived read-only UI', () => {
  assert.match(page, /getStoreAdminProductImages\(id\)/)
  assert.match(page, /<ProductImageManager/)
  assert.match(manager, /archived \?[^:]*Archived product images are read-only[^:]*: <ProductImageUpload/s)
  assert.match(manager, /readOnly=\{archived\}/)
  assert.match(dataAccess, /\.order\('sort_order'[^\n]*\)[\s\S]*\.order\('created_at'[^\n]*\)[\s\S]*\.order\('id'/)
  assert.match(dataAccess, /createSignedUrls\([^,]+, STORE_IMAGE_PREVIEW_TTL_SECONDS\)/s)
  assert.match(dataAccess, /STORE_IMAGE_PREVIEW_TTL_SECONDS = 300/)
})

test('upload is server prepared, browser direct, fixed-bucket, and non-overwriting', () => {
  assert.match(actions, /const path = `\$\{productId\}\/\$\{imageId\}\.\$\{parsed\.extension\}`/)
  assert.match(actions, /bucket: STORE_PRODUCT_IMAGE_BUCKET, path, contentType/)
  assert.match(actions, /is_active: false, is_primary: false/)
  assert.doesNotMatch(actions, /file\.name|input\.path|input\.bucket/)
  assert.match(upload, /supabase\.storage\.from\(prepared\.upload\.bucket\)\.upload\(prepared\.upload\.path, file/)
  assert.match(upload, /upsert: false/)
  assert.match(upload, /finalizeStoreProductImageUpload/)
})

test('all five image mutations authorize, validate ownership, and guard archives', () => {
  for (const name of ['prepareStoreProductImageUpload', 'finalizeStoreProductImageUpload', 'setStoreProductPrimaryImage', 'setStoreProductImageActiveState', 'updateStoreProductImageMetadata']) {
    assert.match(actions, new RegExp(`export async function ${name}[\\s\\S]*?await requireAdmin\\(\\)`))
  }
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 9)
  assert.match(actions, /\.eq\('id', imageId\)\.eq\('product_id', productId\)/)
  assert.match(actions, /publication_status === 'archived'/)
  assert.match(actions, /if \(!isStoreUuid\(productId\)\)/)
  assert.match(actions, /if \(!isStoreUuid\(imageId\)\)/)
})

test('primary changes use only the atomic RPC and activity is readiness safe', () => {
  assert.match(actions, /rpc\('set_evo_store_product_primary_image'/)
  assert.doesNotMatch(actions, /update\(\{ is_primary: false \}\)/)
  assert.match(actions, /if \(!owned\.image\.is_active\)/)
  assert.match(actions, /if \(!active && owned\.image\.is_primary\)/)
  assert.match(actions, /active && !await hasUploadedImageObject/)
  assert.match(actions, /Set another active image as primary before deactivating/)
})

test('safe errors cover image RPC and readiness failures without leaking details', () => {
  assert.match(mapStoreProductImageDatabaseError({ code: 'P0001', message: 'EVO_STORE_IMAGE_ARCHIVED_PRODUCT' }), /read-only/i)
  assert.match(mapStoreProductImageDatabaseError({ code: 'P0002', message: 'EVO_STORE_IMAGE_PRIMARY_IMAGE_NOT_FOUND' }), /does not belong/i)
  assert.match(mapStoreProductImageDatabaseError({ code: 'P0001', message: 'EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED' }), /another active image/i)
  assert.doesNotMatch(mapStoreProductImageDatabaseError({ code: 'XX', message: 'SECRET POLICY' }), /SECRET|POLICY/)
})

test('V1 has no delete path, migration, service role, or permanent-delete UI', async () => {
  const migrationNames = await readdir(new URL('../supabase/migrations/', import.meta.url))
  assert.equal(migrationNames.filter((name) => name.includes('product_image_management')).length, 1)
  for (const source of [actions, manager, upload, card, dataAccess]) {
    assert.doesNotMatch(source, /service.?role|\.remove\(|\.delete\(|Delete image|Remove permanently/i)
  }
})
