import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/lib/printful/product-detail.ts', import.meta.url), 'utf8')

test('Printful detail integration is server-only and read-only', () => {
  assert.match(source, /import 'server-only'/)
  assert.match(source, /method: 'GET'/)
  assert.match(source, /cache: 'no-store'/)
  assert.match(source, /PRINTFUL_API_TOKEN/)
  assert.doesNotMatch(source, /NEXT_PUBLIC_PRINTFUL|method: 'POST'|method: 'DELETE'/)
})

test('Printful detail import remains preview only', async () => {
  const action = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url), 'utf8')
  const preview = action.slice(action.indexOf('export async function previewPrintfulProduct'),
    action.indexOf('export async function importPrintfulDraft'))
  assert.ok(preview.length > 0, 'Preview action must be present')
  assert.match(preview, /requireAdmin\(\)/)
  assert.match(preview, /getPrintfulProductDetail\(id\)/)
  assert.doesNotMatch(preview, /\.insert\(|\.upsert\(|\.update\(|\.upload\(|\.rpc\(/)
})
