import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('import readiness performs no database mutations and is admin restricted', async () => {
 const a = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const section = a.slice(a.indexOf('export async function checkPrintfulImportReadiness'))
 assert.match(section,/await requireAdmin\(\)/)
 assert.match(section,/preparePrintfulDraft\(productId\)/)
 assert.doesNotMatch(section,/\.insert\(|\.update\(|\.upsert\(|\.rpc\(/)
 assert.match(section,/PREFLIGHT_FAILED/)
})
test('import action retains kill switch while readiness check is available', async () => {
 const a = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 assert.match(a,/PRINTFUL_IMPORT_ENABLED !== 'true'/)
 const ui = await readFile(new URL('../src/app/admin/store/printful/connection-check.tsx',import.meta.url),'utf8')
 assert.match(ui,/Check import readiness \(no changes\)/)
 assert.match(ui,/importEnabled && readiness\?\.ready/)
})
