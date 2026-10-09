import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Printful media inspection requires admin and cannot mutate storage or DB', async () => {
  const src = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url),'utf8')
  const action = src.slice(src.indexOf('export async function inspectPrintfulMedia'))
  assert.match(action, /await requireAdmin\(\)/)
  assert.match(action, /previewPrintfulMedia\(id\)/)
  assert.doesNotMatch(action, /\.upload\(|\.insert\(|\.upsert\(|\.rpc\(/)
})

test('Provider preview URLs are strict HTTPS Printful hosts and bounded', async () => {
  const src = await readFile(new URL('../src/lib/printful/media-preview.ts',import.meta.url),'utf8')
  assert.match(src, /url\.protocol !== 'https:'/)
  assert.match(src, /hostname\.endsWith\('\.printful\.com'\)/)
  assert.match(src, /MAX_CANDIDATES = 30/)
  assert.match(src, /verifyPrintfulStoreIdentity/)
  assert.match(src, /X-PF-Store-Id/)
  assert.doesNotMatch(src, /\.upload\(|\.insert\(|\.upsert\(/)
})
