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

test('Upload claims before Storage mutation and finalizes only after checksum verification', async () => {
  const src = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const block = src.slice(src.indexOf('export async function uploadApprovedPrintfulMockup'),
    src.indexOf('export type PrintfulRecoveryDiagnostic'))
  const claimIndex = block.indexOf("'claim_evo_store_printful_mockup_upload'")
  const uploadIndex = block.indexOf(".upload(path, png")
  const downloadIndex = block.indexOf(".download(path)")
  const finalizeIndex = block.indexOf("'complete_evo_store_printful_mockup'")
  assert.ok(claimIndex >= 0 && uploadIndex > claimIndex && downloadIndex > uploadIndex &&
    finalizeIndex > downloadIndex, 'Claim must precede upload, integrity check, and finalization')
  assert.match(block,/p_claim_token: claimToken/)
  assert.match(block,/createHash\('sha256'\)/)
  assert.match(block,/actual !== expected/)
  assert.match(block,/CLAIM_UNAVAILABLE/)
  assert.doesNotMatch(block,/\.remove\(|\.delete\(/)
})

test('Claim token format accepts numeric UUIDs and rejects malformed tokens', async () => {
  const src = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const claimBlock = src.slice(src.indexOf("const { data: claimToken"),src.indexOf("// Upload only as claim holder"))
  assert.match(claimBlock,/claim_evo_store_printful_mockup_upload/)
  assert.match(claimBlock,/CLAIM_UNAVAILABLE/)
  // Regression: avoid double-escaped \\d in regex literal, which rejects numeric UUIDs.
  assert.match(claimBlock,/\[a-f0-9\]/)
  assert.doesNotMatch(claimBlock,/\[a-f\\\\d\]/)
  const tokenPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  assert.equal(tokenPattern.test('12345678-1234-4234-8234-123456789012'),true)
  assert.equal(tokenPattern.test('not-a-uuid'),false)
})

test('Disabled upload gate precedes all provider and database writes',async()=>{
  const src = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const block = src.slice(src.indexOf('export async function uploadApprovedPrintfulMockup'),src.indexOf('export type PrintfulRecoveryDiagnostic'))
  assert.ok(block.indexOf("PRINTFUL_MEDIA_UPLOAD_ENABLED !== 'true'") <
    block.indexOf('stagePrintfulMockupGallery(productId)'))
  assert.ok(block.indexOf("PRINTFUL_MEDIA_UPLOAD_ENABLED !== 'true'") <
    block.indexOf("claim_evo_store_printful_mockup_upload"))
  assert.ok(block.indexOf('upsert: false') > block.indexOf('claim_evo_store_printful_mockup_upload'))
})
