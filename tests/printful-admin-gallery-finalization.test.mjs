import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('Gallery assignment action requires admin, separate launch flag, all upload flags OFF', async()=>{
 const src=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const part=src.slice(src.indexOf('export async function finalizePrintfulGalleryPrimary'))
 assert.match(part,/await requireAdmin\(\)/)
 assert.match(part,/PRINTFUL_GALLERY_FINALIZATION_ENABLED !== 'true'/)
 for(const name of ['PRINTFUL_MEDIA_UPLOAD_ENABLED','PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED','PRINTFUL_NAVY_UPLOAD_ENABLED','PRINTFUL_BLUE_UPLOAD_ENABLED','PRINTFUL_IMPORT_ENABLED']) assert.ok(part.includes(name))
 assert.match(part,/db\.rpc\('finalize_evo_store_printful_gallery'\)/)
})
test('Admin UI is locked by default and invokes once after inspection/confirmation',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
 const ui=await readFile(new URL('../src/app/admin/store/printful/gallery-finalization-control.tsx',import.meta.url),'utf8')
 assert.match(page,/PRINTFUL_GALLERY_FINALIZATION_ENABLED === 'true'/)
 assert.match(ui,/window\.confirm/)
 assert.match(ui,/setAttempted\(true\)/)
 assert.match(ui,/rows\.filter\(row => row\.is_primary\)\.length === 0/)
 assert.match(ui,/inspectPrintfulGallery\(\)/)
 assert.doesNotMatch(ui,/setTimeout|setInterval/)
})
