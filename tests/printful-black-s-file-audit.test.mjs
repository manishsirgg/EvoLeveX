import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('Black/S file audit is fixed-scope, GET-only, sanitized and administrator guarded', async () => {
  const server = await readFile(new URL('../src/lib/printful/black-s-file-audit.ts', import.meta.url), 'utf8')
  const actions = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url), 'utf8')
  const page = await readFile(new URL('../src/app/admin/store/printful/page.tsx', import.meta.url), 'utf8')
  assert.match(server, /SYNC_VARIANT_ID = 5562164619/)
  assert.match(server, /CATALOG_VARIANT_ID = 4866/)
  assert.match(server, /method: 'GET'/)
  assert.match(server, /PREVIEW/)
  assert.match(server, /safeInt\(f\.dpi\)/)
  assert.doesNotMatch(server, /method: 'POST'|\/orders|\.insert\(|\.update\(|\.rpc\(/)
  assert.doesNotMatch(server, /url: f\.url|thumbnail_url:|preview_url:/)
  assert.match(actions, /inspectExistingBlackSFileMetadata\(\) \{\s*await requireAdmin\(\)/)
  assert.match(page, /<BlackSFileAuditControl \/>/)
})
