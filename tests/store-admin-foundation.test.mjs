import assert from 'node:assert/strict'
import test from 'node:test'

import { mapStoreAdminDatabaseError } from '../src/lib/admin-store-errors.ts'
import {
  canTransitionStorePublication,
  isExactStoreMoney,
  isStoreColorCode,
  isStoreSizeCode,
  isStoreSku,
  isStoreSlug,
  isStoreUuid,
  normalizeStoreOptionCode,
  normalizeStoreSku,
  normalizeStoreSlug,
  parseStoreCategoryMutation,
  parseStoreCurrency,
  parseStoreMoney,
  parseStorePublicationTarget,
  parseStoreSafeInteger,
  parseStoreSortOrder,
  parseStoreWeightGrams,
} from '../src/lib/admin-store-validation.ts'

test('Store slugs normalize and validate a narrow URL-safe format', () => {
  assert.equal(normalizeStoreSlug('  Trail & Field Shirt  '), 'trail-field-shirt')
  assert.equal(isStoreSlug('trail-field-shirt'), true)
  assert.equal(isStoreSlug('Trail Field'), false)
  assert.equal(isStoreSlug('-trail'), false)
})

test('SKU and option codes mirror database normalization and limits', () => {
  assert.equal(normalizeStoreSku(' shirt.black/m '), 'SHIRT.BLACK/M')
  assert.equal(isStoreSku('SHIRT.BLACK/M'), true)
  assert.equal(isStoreSku('bad sku'), false)
  assert.equal(isStoreSku(`A${'B'.repeat(64)}`), false)
  assert.equal(normalizeStoreOptionCode(' blue/grey '), 'BLUE/GREY')
  assert.equal(normalizeStoreOptionCode('  '), null)
  assert.equal(isStoreSizeCode('XL-2'), true)
  assert.equal(isStoreColorCode('BLUE_GREY'), true)
  assert.equal(isStoreColorCode('blue'), false)
  assert.equal(isStoreSizeCode(null), true)
})

test('UUID and safe integer validation reject ambiguous or unsafe values', () => {
  assert.equal(isStoreUuid('41000000-0000-4000-8000-000000000001'), true)
  assert.equal(isStoreUuid('not-a-uuid'), false)
  assert.equal(parseStoreSafeInteger('9007199254740991'), Number.MAX_SAFE_INTEGER)
  assert.equal(parseStoreSafeInteger('9007199254740992'), null)
  assert.equal(parseStoreSafeInteger('1.0'), null)
  assert.equal(parseStoreSortOrder('0'), 0)
  assert.equal(parseStoreSortOrder('-1'), null)
})

test('weights require positive safe integral grams', () => {
  assert.equal(parseStoreWeightGrams('250'), 250)
  assert.equal(parseStoreWeightGrams('0'), null)
  assert.equal(parseStoreWeightGrams('1.5'), null)
})

test('currencies use the shared supported-currency source', () => {
  assert.equal(parseStoreCurrency(' jpy '), 'JPY')
  assert.equal(parseStoreCurrency('CHF'), null)
})

test('money remains an exact string and enforces numeric(14,2) and JPY rules', () => {
  assert.equal(isExactStoreMoney('0.10', 'USD'), true)
  assert.equal(parseStoreMoney(' 123456789012.34 ', 'USD'), '123456789012.34')
  assert.equal(parseStoreMoney('1234567890123.45', 'USD'), null)
  assert.equal(parseStoreMoney('1e3', 'USD'), null)
  assert.equal(parseStoreMoney('0.1', 'USD'), '0.1')
  assert.equal(parseStoreMoney('100', 'JPY'), '100')
  assert.equal(parseStoreMoney('100.00', 'JPY'), null)
  assert.equal(parseStoreMoney(0.1 + 0.2, 'USD'), null, 'binary floats never enter persistence validation')
})

test('publication targets are explicit and archived is terminal', () => {
  assert.equal(parseStorePublicationTarget('published'), 'published')
  assert.equal(parseStorePublicationTarget('active'), null)
  assert.equal(canTransitionStorePublication('draft', 'published'), true)
  assert.equal(canTransitionStorePublication('archived', 'draft'), false)
  assert.equal(canTransitionStorePublication('archived', 'published'), false)
})

test('database errors map known classes without leaking internals', () => {
  assert.match(mapStoreAdminDatabaseError({ code: '23505', message: 'secret constraint name' }), /already exists/)
  assert.match(mapStoreAdminDatabaseError({ code: '23503' }), /linked/)
  assert.match(mapStoreAdminDatabaseError({ code: '23514' }), /required rules/)
  assert.match(mapStoreAdminDatabaseError({ code: '42501' }), /not authorized/)
  assert.match(mapStoreAdminDatabaseError({ code: 'P0001', message: 'EVO_STORE_READY_IMAGE_REQUIRED' }), /image/)
  assert.match(mapStoreAdminDatabaseError({ code: 'P0001', message: 'EVO_STORE_READY_FUTURE_RULE' }), /not ready/)
  assert.match(mapStoreAdminDatabaseError({ code: 'P0002' }), /not been initialized/)
  assert.match(mapStoreAdminDatabaseError({ code: '22023' }), /inventory input/)
  assert.match(mapStoreAdminDatabaseError({ code: '22004' }), /inventory input/)
  const unknown = mapStoreAdminDatabaseError({ code: 'XX999', message: 'password=secret SQL select *' })
  assert.equal(unknown, 'The Store change could not be completed. Please try again.')
  assert.doesNotMatch(unknown, /secret|SQL|select/)
})


test('Store category form supports a nullable validated parent', () => {
  const input = { name: 'T-Shirts', slug: 't-shirts', parent_id: '41000000-0000-4000-8000-000000000001', sort_order: '1', is_active: 'on' }
  const child = parseStoreCategoryMutation(input)
  assert.equal(child.success, true)
  if (child.success) assert.equal(child.data.parent_id, input.parent_id)
  const root = parseStoreCategoryMutation({ ...input, parent_id: '' })
  assert.equal(root.success, true)
  if (root.success) assert.equal(root.data.parent_id, null)
  const invalid = parseStoreCategoryMutation({ ...input, parent_id: 'not-a-uuid' })
  assert.equal(invalid.success, false)
})
