import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('new Printful sync is independently gated, admin-only, category-reviewed and draft-only', async () => {
  const actions=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
  const control=await readFile(new URL('../src/app/admin/store/printful/draft-sync-control.tsx',import.meta.url),'utf8')
  const start=actions.indexOf('export async function synchronizeNewPrintfulDraft')
  assert.ok(start>=0)
  const handler=actions.slice(start)
  assert.match(handler,/await requireAdmin\(\)/)
  assert.match(handler,/PRINTFUL_DRAFT_SYNC_ENABLED/)
  assert.match(handler,/LEGACY_IMPORT_MUST_BE_DISABLED/)
  assert.match(handler,/discovery\.truncated/)
  assert.match(handler,/ALREADY_IMPORTED/)
  assert.match(handler,/CATEGORY_NOT_LEAF/)
  assert.match(handler,/import_evo_store_printful_draft/)
  assert.doesNotMatch(handler,/\.insert\(|\.update\(|\.upsert\(|\/orders/)
  assert.match(control,/authorize one draft-only import/)
  assert.match(control,/p\.action === 'EXISTS'/)
  assert.match(page,/<DraftSyncControl \/>/)
})
