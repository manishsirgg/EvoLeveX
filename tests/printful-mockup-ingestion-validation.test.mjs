import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Printful binary probe requires admin and picks provider URL from staged allowlist', async () => {
  const text = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url),'utf8')
  const action = text.slice(text.indexOf('export async function verifyPrintfulMockupBytes'))
  assert.match(action,/await requireAdmin\(\)/)
  assert.match(action,/stagePrintfulMockupGallery\(productId\)/)
  assert.match(action,/gallery\.mockups\.find\(file => file\.fileId === fileId\)/)
  assert.doesNotMatch(action,/\.upload\(|\.insert\(|\.update\(|\.upsert\(|\.rpc\(/)
})
test('Binary probe enforces HTTPS exact provider host, disallows redirects and caps reads',async()=>{
 const src=await readFile(new URL('../src/lib/printful/mockup-ingestion-validate.ts',import.meta.url),'utf8')
 for (const check of ["url.hostname !== 'files.cdn.printful.com'","redirect: 'error'","MAX_BYTES = 5 * 1024 * 1024","total > MAX_BYTES","INVALID_PNG_SIGNATURE","INVALID_PNG_DIMENSIONS"]) assert.ok(src.includes(check), check)
 assert.doesNotMatch(src,/\.upload\(|\.insert\(|\.upsert\(/)
})
