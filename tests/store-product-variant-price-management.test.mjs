import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { mapStoreVariantPriceDatabaseError } from '../src/lib/admin-store-errors.ts'
import { parseStoreCurrency, parseStorePriceActiveState, parseStoreVariantPriceAmount } from '../src/lib/admin-store-validation.ts'

const actions = await readFile(new URL('../src/app/admin/store/products/actions.ts', import.meta.url), 'utf8')
const data = await readFile(new URL('../src/lib/admin-store.ts', import.meta.url), 'utf8')
const manager = await readFile(new URL('../src/app/admin/store/products/product-variant-manager.tsx', import.meta.url), 'utf8')
const prices = await readFile(new URL('../src/app/admin/store/products/product-variant-price-manager.tsx', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/app/admin/store/products/[id]/page.tsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261005030000_evo_store_variant_price_management_support.sql', import.meta.url), 'utf8')

test('exact price parser mirrors numeric(14,2), currency, and JPY rules', () => {
  for (const [input, amount] of [['12', '12'], ['12.9', '12.9'], ['12.90', '12.90'], [' 0.00 ', '0.00']]) {
    assert.deepEqual(parseStoreVariantPriceAmount(input, 'USD'), { success: true, amount, positive: input.trim() !== '0' && input.trim() !== '0.00' })
  }
  for (const input of ['.99', '1.234', '+1', '1e3', '1,000', '$12', '', ' ', '0001']) assert.equal(parseStoreVariantPriceAmount(input, 'USD').success, false)
  assert.match(parseStoreVariantPriceAmount('-1', 'USD').error, /negative/)
  assert.equal(parseStoreVariantPriceAmount('999999999999.99', 'USD').success, true)
  assert.equal(parseStoreVariantPriceAmount('1000000000000', 'USD').success, false)
  assert.deepEqual(parseStoreVariantPriceAmount('1000.00', 'JPY'), { success: true, amount: '1000', positive: true })
  assert.match(parseStoreVariantPriceAmount('1000.50', 'JPY').error, /whole yen/)
  assert.equal(parseStoreCurrency(' jpy '), 'JPY')
  assert.equal(parseStoreCurrency('CHF'), null)
  assert.equal(parseStorePriceActiveState(false), false)
  assert.equal(parseStorePriceActiveState('false'), null)
})

test('price UI is nested in preserved variant manager and image manager remains', () => {
  assert.match(manager, /ProductVariantPriceManager/)
  assert.match(manager, /Inventory configured/)
  assert.match(page, /ProductImageManager/)
  assert.match(page, /ProductVariantManager/)
  assert.match(prices, /Archived product prices are read-only/)
  assert.match(prices, /available\.length/)
  assert.doesNotMatch(prices, /Delete|Remove permanently|exchange|tax|GST|quantity/i)
})

test('all price mutations authorize and verify the complete ownership chain', () => {
  const names = ['createStoreVariantPriceAction', 'updateStoreVariantPriceAction', 'setStoreVariantPriceActiveStateAction']
  for (const [index, name] of names.entries()) {
    const end = index + 1 < names.length ? actions.indexOf(`export async function ${names[index + 1]}`) : actions.indexOf('export async function createStoreProductAction')
    const body = actions.slice(actions.indexOf(`export async function ${name}`), end)
    assert.match(body, /await requireAdmin\(\)/)
    assert.match(body, /isStoreUuid\(productId\)/)
    assert.match(body, /isStoreUuid\(variantId\)/)
    assert.match(body, /loadMutablePriceProduct/)
    assert.match(body, /loadOwnedVariant/)
    if (name !== names[0]) { assert.match(body, /isStoreUuid\(priceId\)/); assert.match(body, /loadOwnedVariantPrice/) }
  }
  assert.match(actions, /\.eq\('id', variantId\)\.eq\('product_id', productId\)/)
  assert.match(actions, /\.eq\('id', priceId\)\.eq\('variant_id', variantId\)/)
  assert.match(actions, /publication_status === 'archived'/)
})

test('mutations whitelist writes, force creation active, and preserve lifecycle rules', () => {
  const priceActions = actions.slice(actions.indexOf('export async function createStoreVariantPriceAction'), actions.indexOf('export async function createStoreProductAction'))
  assert.match(priceActions, /amount: parsed\.amount, is_active: true/)
  assert.match(priceActions, /update\(\{ amount: parsed\.amount \}\)/)
  assert.match(priceActions, /update\(\{ is_active: parsedActive \}\)/)
  assert.match(priceActions, /Active prices must be greater than zero/)
  assert.doesNotMatch(priceActions, /publication_status: 'draft'|evo_store_inventory|\.rpc\(|\.delete\(|currency:/)
  assert.doesNotMatch(priceActions, /parseFloat|Number\(/)
  assert.doesNotMatch(priceActions, /evo_store_variants[^\n]*update\([\s\S]*?(?:price|currency)/)
})

test('authoritative prices load once in deterministic order and drive readiness indicator', () => {
  const loader = data.slice(data.indexOf('export async function getStoreAdminProductVariants'))
  assert.match(loader, /evo_store_variant_prices/)
  assert.match(loader, /\.in\('variant_id', ids\)\.order\('currency'\)\.order\('created_at'\)\.order\('id'\)/)
  assert.match(loader, /pricesByVariant/)
  assert.match(loader, /price\.is_active/)
  assert.equal((loader.match(/from\('evo_store_variant_prices'\)/g) ?? []).length, 1)
  assert.doesNotMatch(data, /SUPABASE_SERVICE_ROLE_KEY|service.?role/i)
})

test('price database failures map to safe actionable messages', () => {
  assert.match(mapStoreVariantPriceDatabaseError({ code: '23505', message: 'private constraint' }), /already has a price/)
  assert.match(mapStoreVariantPriceDatabaseError({ code: 'P0001', message: 'EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT' }), /read-only/)
  assert.match(mapStoreVariantPriceDatabaseError({ code: 'P0001', message: 'EVO_STORE_READY_VARIANT_PRICE_REQUIRED' }), /published product/)
  assert.doesNotMatch(mapStoreVariantPriceDatabaseError({ code: 'XX', message: 'SECRET SQL' }), /SECRET|SQL/)
})

test('merged prerequisite still guards authoritative price mutations', () => {
  assert.match(migration, /before insert or update or delete on public\.evo_store_variant_prices/)
  assert.match(migration, /EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT/)
})
