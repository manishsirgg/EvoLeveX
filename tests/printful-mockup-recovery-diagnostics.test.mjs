import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Recovery SQL is admin-only and read-only',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261010030000_printful_mockup_recovery_diagnostics.sql',import.meta.url),'utf8')
 for(const term of ["auth.uid()","'admin','super_admin'","PENDING_OBJECT_PRESENT","PENDING_OBJECT_MISSING","MANUAL_REVIEW_REQUIRED","storage.objects","REVOKE ALL"]) assert.ok(sql.includes(term),term)
 const body=sql.slice(sql.indexOf('AS $$'),sql.lastIndexOf('$$;'))
 assert.doesNotMatch(body,/\b(INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO|FROM|public\.|private\.|storage\.)/i)
})
test('Recovery action is admin-only, allows fixed IDs and has no mutations',async()=>{
 const src=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const action=src.slice(src.indexOf('export async function inspectPrintfulMockupRecovery'))
 assert.match(action,/await requireAdmin\(\)/)
 assert.match(action,/\[1082848720,1082848721,1082848722\]\.includes\(fileId\)/)
 assert.match(action,/inspect_evo_store_printful_mockup_recovery/)
 assert.doesNotMatch(action,/\.upload\(|\.remove\(|\.insert\(|\.update\(|\.upsert\(/)
})
