import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Printful reconciliation is a read-only admin preview and retains the existing product',async()=>{
  const actions=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
  const start=actions.indexOf('export async function previewPrintfulCatalogReconciliation')
  assert.ok(start>=0)
  const end=actions.indexOf('export async function synchronizeNewPrintfulDraft', start)
  const handler=actions.slice(start, end === -1 ? undefined : end)
  assert.match(handler,/await requireAdmin\(\)/)
  assert.match(handler,/discovery\.truncated/)
  assert.match(handler,/\.select\('id,slug,name,publication_status'\)/)
  assert.match(handler,/\`printful-\$\{item\.syncProductId\}\`/)
  assert.match(handler,/NEW_DRAFT/)
  assert.doesNotMatch(handler,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/)
  assert.match(page,/<CatalogReconciliationPreview \/>/)
  assert.match(page, /<summary[^>]*>Legacy Printful diagnostics<\/summary>/)
  assert.match(page, /<BlackUploadControl/)
  assert.match(page, /<LandedCostWorksheetControl/)
  assert.ok(page.indexOf('<CatalogReconciliationPreview />') < page.indexOf('<details'))
})
