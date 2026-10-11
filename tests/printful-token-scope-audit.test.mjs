import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('token scope audit is GET-only and does not change Printful state', async () => {
  const src = await readFile(new URL('../src/lib/printful/token-scope-audit.ts', import.meta.url), 'utf8')
  assert.match(src, /oauth\/scopes/)
  assert.match(src, /method: 'GET'/)
  assert.match(src, /cache: 'no-store'/)
  assert.match(src, /shippingAccess: 'not-established'/)
  assert.doesNotMatch(src, /method: 'POST'|method: 'PATCH'|\.rpc\(|\.insert\(|\.update\(|\.upsert\(/)
})
test('token scopes require server-side admin authorization', async () => {
  const actions = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url), 'utf8')
  assert.match(actions, /export async function inspectPrintfulTokenScopeAudit\(\) \{\s*await requireAdmin\(\)/)
  const page = await readFile(new URL('../src/app/admin/store/printful/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /await requireAdmin\(\)/)
  assert.match(page, /<TokenScopeAuditControl \/>/)
})
