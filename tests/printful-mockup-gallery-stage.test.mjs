import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('gallery stage is constrained to one reviewed product and three distinct Printful mockups', async () => {
 const text = await readFile(new URL('../src/lib/printful/mockup-gallery-stage.ts',import.meta.url),'utf8')
 assert.match(text,/STORE_PRODUCT_ID = 479728769/)
 for(const id of ['1082848720','1082848721','1082848722']) assert.match(text,new RegExp(id))
 assert.match(text,/media\.inspectedVariants !== 18/)
 assert.match(text,/c\.type === 'preview'/)
 assert.match(text,/candidates\.length !== 1/)
 assert.doesNotMatch(text,/\.upload\(|\.insert\(|\.upsert\(|\.rpc\(/)
})
test('gallery stage access requires admin; no write action exists',async()=>{
 const text = await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const block = text.slice(text.indexOf('export async function previewStagedPrintfulGallery'), text.indexOf('export async function verifyPrintfulMockupBytes'))
 assert.match(block,/await requireAdmin\(\)/)
 assert.match(block,/stagePrintfulMockupGallery\(id\)/)
 assert.doesNotMatch(block,/\.upload\(|\.insert\(|\.upsert\(/)
})
