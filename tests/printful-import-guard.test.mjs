import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('draft import is admin-gated, server-sourced and disabled by default', async () => {
  const action = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  assert.match(action,/await requireAdmin\(\)/)
  assert.match(action,/PRINTFUL_IMPORT_ENABLED !== 'true'/)
  assert.match(action,/await preparePrintfulDraft\(productId\)/)
  assert.match(action,/import_evo_store_printful_draft/)
  assert.doesNotMatch(action,/\.insert\(|\.upsert\(/)
})
test('catalog metadata is authoritative for dimensions', async () => {
  const source = await readFile(new URL('../src/lib/printful/prepare-import.ts',import.meta.url),'utf8')
  assert.match(source,/products\/variant\//)
  assert.match(source,/catalog\.size/)
  assert.match(source,/catalog\.color/)
  assert.doesNotMatch(source,/item\.name\.match/)
})
