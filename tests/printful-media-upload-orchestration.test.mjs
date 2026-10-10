import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Upload is off by default, admin-only and never overwrites objects', async () => {
  const src = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const block = src.slice(src.indexOf('export async function uploadApprovedPrintfulMockup'))
  for(const pattern of [/await requireAdmin\(\)/,/PRINTFUL_MEDIA_UPLOAD_ENABLED !== 'true'/,/stagePrintfulMockupGallery\(productId\)/,/decodeApprovedPrintfulMockup\(candidate.providerUrl\)/,/upsert: false/,/RECONCILIATION_REQUIRED/]) assert.match(block,pattern)
  assert.doesNotMatch(block,/\.remove\(|\.delete\(/)
})
test('Decode is bounded and uses trusted decoder', async () => {
  const src=await readFile(new URL('../src/lib/printful/mockup-decode.ts',import.meta.url),'utf8')
  assert.match(src,/sharp\(input,/)
  assert.match(src,/limitInputPixels: MAX_PIXELS/)
  assert.match(src,/\.png\(\{ compressionLevel: 9 \}\)\.toBuffer\(\)/)
})
test('Finalization requires admin and uploaded storage object',async()=>{
 const src=await readFile(new URL('../supabase/migrations/20261010020000_printful_mockup_upload_finalize.sql',import.meta.url),'utf8')
 for(const word of ['PRINTFUL_MEDIA_FORBIDDEN','storage.objects','PRINTFUL_MEDIA_OBJECT_MISSING',"status='verified'",'is_active=true','REVOKE ALL']) assert.ok(src.includes(word),word)
})
