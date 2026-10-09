import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { mapStoreCategoryDatabaseError } from '../src/lib/admin-store-errors.ts'
import {
  isStoreUuid,
  parseStoreCategoryMutation,
} from '../src/lib/admin-store-validation.ts'

const actions = await readFile(new URL('../src/app/admin/store/categories/actions.ts', import.meta.url), 'utf8')
const listPage = await readFile(new URL('../src/app/admin/store/categories/page.tsx', import.meta.url), 'utf8')
const editPage = await readFile(new URL('../src/app/admin/store/categories/[id]/page.tsx', import.meta.url), 'utf8')

test('valid category create input is normalized into the exact mutation shape', () => {
  const result = parseStoreCategoryMutation({
    name: '  Trail Gear  ',
    slug: ' Trail & Gear ',
    description: '  Outdoor essentials.  ',
    sort_order: '4',
    is_active: 'on',
  })
  assert.deepEqual(result, {
    success: true,
    data: {
      name: 'Trail Gear',
      slug: 'trail-gear',
      description: 'Outdoor essentials.',
      parent_id: null,
      sort_order: 4,
      is_active: true,
    },
  })
})

test('category input requires a non-empty name and valid normalized slug', () => {
  const emptyName = parseStoreCategoryMutation({ name: ' ', slug: 'valid', sort_order: '0' })
  assert.equal(emptyName.success, false)
  if (!emptyName.success) assert.match(emptyName.state.error ?? '', /name is required/i)

  const invalidSlug = parseStoreCategoryMutation({ name: 'Symbols', slug: '!!!', sort_order: '0' })
  assert.equal(invalidSlug.success, false)
  if (!invalidSlug.success) assert.match(invalidSlug.state.error ?? '', /valid URL slug/i)
})

test('category sort order must be a non-negative safe integer', () => {
  for (const sort_order of ['-1', '1.5', '9007199254740992', '']) {
    assert.equal(parseStoreCategoryMutation({ name: 'Gear', slug: 'gear', sort_order }).success, false)
  }
  assert.equal(parseStoreCategoryMutation({ name: 'Gear', slug: 'gear', sort_order: '0' }).success, true)
})

test('category activation accepts only the form checkbox value', () => {
  const active = parseStoreCategoryMutation({ name: 'Gear', slug: 'gear', sort_order: '0', is_active: 'on' })
  const inactive = parseStoreCategoryMutation({ name: 'Gear', slug: 'gear', sort_order: '0', is_active: 'true' })
  assert.equal(active.success && active.data.is_active, true)
  assert.equal(inactive.success && inactive.data.is_active, false)
})

test('category mutation payload excludes image_url and arbitrary client fields', () => {
  const result = parseStoreCategoryMutation({
    name: 'Gear', slug: 'gear', sort_order: '1', is_active: 'on',
    image_url: 'https://attacker.invalid/image.jpg', id: 'changed', created_at: 'changed', arbitrary: 'changed',
  })
  assert.equal(result.success, true)
  if (result.success) {
    assert.deepEqual(Object.keys(result.data).sort(), ['description', 'is_active', 'name', 'parent_id', 'slug', 'sort_order'])
    assert.equal('image_url' in result.data, false)
    assert.equal('arbitrary' in result.data, false)
  }
})

test('edit UUID validation rejects invalid identifiers', () => {
  assert.equal(isStoreUuid('33000000-0000-4000-8000-000000000001'), true)
  assert.equal(isStoreUuid('not-a-category'), false)
})

test('category database failures have safe specific messages', () => {
  assert.equal(mapStoreCategoryDatabaseError({ code: '23505', message: 'evo_store_categories_slug_key' }), 'That category slug is already in use. Choose another slug.')
  assert.equal(mapStoreCategoryDatabaseError({ code: 'P0001', message: 'EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED' }), 'This category cannot be deactivated while published products depend on it.')
  const unknown = mapStoreCategoryDatabaseError({ code: 'XX999', message: 'SQL password=secret' })
  assert.equal(unknown, 'The Store change could not be completed. Please try again.')
  assert.doesNotMatch(unknown, /SQL|secret/)
})

test('category routes and every category Server Action enforce admin authorization', () => {
  assert.match(listPage, /await requireAdmin\(\)/)
  assert.match(editPage, /await requireAdmin\(\)/)
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 2)
  assert.doesNotMatch(actions, /service-role|serviceRole|createService/)
  assert.doesNotMatch(actions, /\.delete\s*\(/)
})
