import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('configuration inspector is fixed-product GET only and admin authorized', async () => {
  const server = await readFile(new URL('../src/lib/printful/production-configuration.ts', import.meta.url), 'utf8')
  const actions = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url), 'utf8')
  const page = await readFile(new URL('../src/app/admin/store/printful/page.tsx', import.meta.url), 'utf8')
  assert.match(server, /method: 'GET'/)
  assert.match(server, /store\/products\/479728769/)
  assert.match(server, /EXPECTED_VARIANTS = 18/)
  assert.doesNotMatch(server, /\.insert\(|\.update\(|\.rpc\(|\/orders|method: 'POST'/)
  assert.match(actions, /export async function inspectExistingPrintfulProductionConfiguration\(\) \{\s*await requireAdmin\(\)/)
  assert.match(page, /<ProductionConfigurationControl \/>/)
})
