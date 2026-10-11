import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Navy and Blue server actions independently require admin and their own mutually exclusive flags',async()=>{
 const src=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const navy=src.slice(src.indexOf('export async function uploadMidnightNavyPrintfulMockup'),src.indexOf('export async function uploadCoolBluePrintfulMockup'))
 const blue=src.slice(src.indexOf('export async function uploadCoolBluePrintfulMockup'),src.indexOf('export type PrintfulRecoveryDiagnostic'))
 assert.match(navy,/await requireAdmin\(\)/)
 assert.match(blue,/await requireAdmin\(\)/)
 assert.match(navy,/PRINTFUL_NAVY_UPLOAD_ENABLED !== 'true'/)
 assert.match(navy,/PRINTFUL_BLUE_UPLOAD_ENABLED === 'true'/)
 assert.match(blue,/PRINTFUL_BLUE_UPLOAD_ENABLED !== 'true'/)
 assert.match(blue,/PRINTFUL_NAVY_UPLOAD_ENABLED === 'true'/)
 assert.match(navy,/PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED === 'true'/)
 assert.match(blue,/PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED === 'true'/)
 assert.match(navy,/uploadApprovedPrintfulMockup\(479728769,1082848721\)/)
 assert.match(blue,/uploadApprovedPrintfulMockup\(479728769,1082848722\)/)
})

test('New administrator controls are locked by default and require mutually exclusive deployment flags',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
 assert.match(page,/NavyBlueUploadControls/)
 for(const flag of ['PRINTFUL_MEDIA_UPLOAD_ENABLED','PRINTFUL_NAVY_UPLOAD_ENABLED','PRINTFUL_BLUE_UPLOAD_ENABLED','PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED']) assert.ok(page.includes(flag))
})

test('Each panel requires NOT_RESERVED recovery state, confirmation and one attempt',async()=>{
 const ui=await readFile(new URL('../src/app/admin/store/printful/navy-blue-upload-controls.tsx',import.meta.url),'utf8')
 assert.match(ui,/recovery === 'NOT_RESERVED'/)
 assert.match(ui,/window\.confirm/)
 assert.match(ui,/setAttempted\(true\)/)
 assert.match(ui,/inspectPrintfulMockupRecovery\(PRODUCT_ID,choice\.fileId\)/)
 assert.match(ui,/if \(!safeToStart\) return/)
 assert.doesNotMatch(ui,/setTimeout|setInterval|\.remove\(|\.delete\(/)
})
