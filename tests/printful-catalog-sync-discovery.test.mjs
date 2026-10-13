import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('catalog sync discovery is admin-only, paginated and does not write', async () => {
  const server = await readFile(new URL('../src/lib/printful/catalog-sync-discovery.ts',import.meta.url),'utf8')
  const actions = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const page = await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
  assert.match(server,/PRINTFUL_CATALOG_SYNC_DISCOVERY_ENABLED/)
  assert.match(server,/verifyPrintfulStoreIdentity/)
  assert.match(server,/MAX_PAGES = 10/)
  assert.match(server,/offset=\$\{page \* LIMIT\}/)
  assert.match(server,/method: 'GET'/)
  assert.doesNotMatch(server,/method: 'POST'|\/orders|\.upsert\(|\.insert\(|\.update\(/)
  assert.match(actions,/discoverCatalogSyncCandidates\(\) \{\s*await requireAdmin\(\)/)
  assert.match(page,/<CatalogSyncDiscoveryControl \/>/)
})
