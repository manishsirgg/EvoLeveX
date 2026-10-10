import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('recovery classifications do not silently activate an unverified image', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261010030000_printful_mockup_recovery_diagnostics.sql', import.meta.url), 'utf8')
  const checks = ['NOT_RESERVED','PENDING_OBJECT_PRESENT','PENDING_OBJECT_MISSING','COMPLETE','MANUAL_REVIEW_REQUIRED']
  for (const check of checks) assert.ok(sql.includes(check), check)
  assert.match(sql, /storage\.objects/)
  assert.match(sql, /found_image\.is_active AND object_found/)
})
test('upload does not attempt cleanup when upload or finalization fails', async () => {
  const source = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url), 'utf8')
  const action = source.slice(source.indexOf('export async function uploadApprovedPrintfulMockup'), source.indexOf('export async function inspectPrintfulMockupRecovery'))
  assert.match(action, /upsert: false/)
  assert.match(action, /RECONCILIATION_REQUIRED/)
  assert.doesNotMatch(action, /\.remove\(|\.delete\(/)
  assert.match(action, /PRINTFUL_MEDIA_UPLOAD_ENABLED !== 'true'/)
})
