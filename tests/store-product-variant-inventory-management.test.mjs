import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { mapStoreVariantInventoryDatabaseError } from '../src/lib/admin-store-errors.ts'
import { parseStoreInventoryPositiveQuantity, parseStoreInventoryQuantity } from '../src/lib/admin-store-validation.ts'

const actions = await readFile(new URL('../src/app/admin/store/products/actions.ts', import.meta.url), 'utf8')
const data = await readFile(new URL('../src/lib/admin-store.ts', import.meta.url), 'utf8')
const manager = await readFile(new URL('../src/app/admin/store/products/product-variant-manager.tsx', import.meta.url), 'utf8')
const inventoryManager = await readFile(new URL('../src/app/admin/store/products/product-variant-inventory-manager.tsx', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/app/admin/store/products/[id]/page.tsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261005040000_evo_store_inventory_management_support.sql', import.meta.url), 'utf8')

test('strict inventory integer parsing accepts only canonical unsigned int4 values', () => {
  for (const [input, expected] of [['0', 0], ['1', 1], ['10', 10], ['2147483647', 2147483647]]) assert.equal(parseStoreInventoryQuantity(input), expected)
  for (const input of ['', ' ', '-1', '+1', '1.0', '1.5', '1e3', '1E3', '1,000', '₹10', 'abc', '0x10', '2147483648', '00']) assert.equal(parseStoreInventoryQuantity(input), null)
  assert.equal(parseStoreInventoryPositiveQuantity('0'), null)
  assert.equal(parseStoreInventoryPositiveQuantity('1'), 1)
  assert.equal(parseStoreInventoryPositiveQuantity('2147483647'), 2147483647)
})

test('Inventory Manager is integrated without replacing existing managers', () => {
  assert.match(manager, /ProductVariantInventoryManager/)
  assert.match(manager, /ProductVariantPriceManager/)
  assert.match(page, /ProductImageManager/)
  assert.match(page, /ProductVariantManager/)
  assert.match(inventoryManager, /Inventory configured/)
  assert.match(inventoryManager, /On hand/)
  assert.match(inventoryManager, /Reserved/)
  assert.match(inventoryManager, /Available/)
  assert.match(inventoryManager, /quantity_on_hand - inventory\.quantity_reserved/)
})

test('archived products render inventory read-only while inactive variants are not restricted', () => {
  assert.match(inventoryManager, /archived.*read-only/is)
  assert.match(inventoryManager, /archived \?[^:]+:[\s\S]*Initialize inventory/)
  assert.doesNotMatch(inventoryManager, /is_active/)
  assert.match(actions, /publication_status === 'archived'/)
  assert.doesNotMatch(actions.slice(actions.indexOf('initializeStoreVariantInventoryAction')), /is_active/)
})

test('every inventory mutation authorizes, validates IDs through ownership preparation, and uses the authenticated client', () => {
  const names = ['initializeStoreVariantInventoryAction', 'addStoreVariantInventoryAction', 'removeStoreVariantInventoryAction', 'setStoreVariantInventoryAction']
  for (const [index, name] of names.entries()) {
    const start = actions.indexOf(`export async function ${name}`)
    const end = index + 1 < names.length ? actions.indexOf(`export async function ${names[index + 1]}`) : actions.length
    const body = actions.slice(start, end)
    assert.match(body, /await requireAdmin\(\)/)
    assert.match(body, /prepareInventoryMutation\(productId, variantId\)/)
    assert.match(body, /adjust_evo_store_inventory/)
    assert.match(body, /revalidateProductRoutes\(productId\)/)
  }
  assert.match(actions, /isStoreUuid\(productId\)/)
  assert.match(actions, /isStoreUuid\(variantId\)/)
  assert.match(actions, /\.eq\('id', variantId\)\.eq\('product_id', productId\)/)
  assert.match(actions, /createClient\(\)/)
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY|service.?role/i)
})

test('RPC modes, server-derived deltas, and exact reasons implement all operations', () => {
  const inventoryActions = actions.slice(actions.indexOf('initializeStoreVariantInventoryAction'))
  assert.match(inventoryActions, /p_mode: 'initialize'.*p_quantity: quantity.*p_reason: 'initial_stock'/s)
  assert.match(inventoryActions, /p_mode: 'adjust'.*p_quantity: quantity.*p_reason: 'stock_received'/s)
  assert.match(inventoryActions, /p_mode: 'adjust'.*p_quantity: -quantity.*p_reason: reasonInput/s)
  assert.match(inventoryActions, /p_mode: 'set'.*p_quantity: quantity.*p_reason: 'stock_count'/s)
  assert.match(inventoryActions, /\['damage', 'loss', 'manual_correction'\]/)
  assert.match(inventoryActions, /includes\(reasonInput/)
  assert.doesNotMatch(inventoryManager, /value="-\d|signed|p_quantity/)
})

test('inventory mutations contain no direct DML, movement writes, reserved writes, or read-modify-write arithmetic', () => {
  const inventoryActions = actions.slice(actions.indexOf('initializeStoreVariantInventoryAction'))
  assert.doesNotMatch(inventoryActions, /evo_store_inventory_movements|quantity_reserved|\.insert\(|\.update\(|\.delete\(/)
  assert.doesNotMatch(inventoryActions, /quantity_on_hand\s*[+-]/)
  assert.doesNotMatch(inventoryManager, /name="quantity_reserved"|Delete inventory|Reset inventory/)
})

test('one batched inventory query supplies both the object and configured indicator', () => {
  const loader = data.slice(data.indexOf('export async function getStoreAdminProductVariants'))
  assert.equal((loader.match(/from\('evo_store_inventory'\)/g) ?? []).length, 1)
  assert.match(loader, /\.in\('variant_id', ids\)/)
  assert.match(loader, /quantity_on_hand,quantity_reserved,created_at,updated_at/)
  assert.match(loader, /inventory: authoritativeInventory/)
  assert.match(loader, /inventory_configured: authoritativeInventory !== null/)
})

test('inventory failures map safely and specifically', () => {
  const cases = [
    [{ code: 'P0001', message: 'EVO_STORE_INVENTORY_ARCHIVED_PRODUCT' }, /read-only/],
    [{ code: '23505', message: 'secret constraint' }, /already initialized/],
    [{ code: 'P0002', message: 'inventory row does not exist' }, /not been initialized/],
    [{ code: '22023', message: 'resulting stock cannot be negative' }, /not enough/],
    [{ code: '22023', message: 'resulting stock cannot be below reserved stock' }, /reserved/],
    [{ code: '22023', message: 'set quantity must change stock' }, /unchanged/],
    [{ code: '22003', message: 'overflow details' }, /supported range/],
    [{ code: '42501', message: 'staff access required' }, /not authorized/],
  ]
  for (const [error, pattern] of cases) assert.match(mapStoreVariantInventoryDatabaseError(error), pattern)
  assert.doesNotMatch(mapStoreVariantInventoryDatabaseError({ code: 'XX', message: 'SECRET SQL constraint' }), /SECRET|SQL|constraint/)
})

test('the frozen prerequisite preserves database authority and application scope excludes later phases', () => {
  assert.match(migration, /adjust_evo_store_inventory/)
  assert.match(migration, /EVO_STORE_INVENTORY_ARCHIVED_PRODUCT/)
  assert.match(migration, /private\.is_staff\(\)/)
  assert.match(migration, /quantity_on_hand - inventory_row\.quantity_reserved/)
  assert.doesNotMatch(inventoryManager, /checkout|Razorpay|tax|GST|FX|reservation expiration|warehouse|movement history/i)
})
