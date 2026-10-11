import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('First Black mockup control uses separate server-side authorization and exact file', async () => {
  const src=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
  const block=src.slice(src.indexOf('export async function uploadFirstBlackPrintfulMockup'),src.indexOf('export async function uploadMidnightNavyPrintfulMockup'))
  assert.match(block,/await requireAdmin\(\)/)
  assert.match(block,/PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED !== 'true'/)
  assert.match(block,/uploadApprovedPrintfulMockup\(479728769,1082848720\)/)
  assert.doesNotMatch(block,/1082848721|1082848722/)
})

test('Admin control remains disabled without independent and general upload flags',async()=>{
  const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
  assert.match(page,/await requireAdmin\(\)/)
  assert.match(page,/PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED === 'true'/)
  assert.match(page,/PRINTFUL_MEDIA_UPLOAD_ENABLED === 'true'/)
})

test('UI offers explicit confirmation, no automatic retries, and read-only inspection',async()=>{
  const src=await readFile(new URL('../src/app/admin/store/printful/black-upload-control.tsx',import.meta.url),'utf8')
  assert.match(src,/window\.confirm/)
  assert.match(src,/setAttempted\(true\)/)
  assert.match(src,/if \(!authorized \|\| !confirmed \|\| pending \|\| attempted\) return/)
  assert.match(src,/inspectPrintfulMockupRecovery\(PRODUCT_ID,FILE_ID\)/)
  assert.doesNotMatch(src,/setTimeout|setInterval|\.remove\(|\.delete\(/)
})
