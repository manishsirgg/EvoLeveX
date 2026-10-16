import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261016090000_store_reconciliation_operator_gate.sql',import.meta.url),'utf8')
test('reconciliation role gate only permits admin and super_admin',()=>{
  assert.match(sql,/r\.code IN \('super_admin','admin'\)/)
  assert.doesNotMatch(sql,/r\.code IN \([^)]*'editor'|r\.code IN \([^)]*'support'/)
  assert.match(sql,/auth\.uid\(\)/)
  assert.match(sql,/RETURNS boolean/)
})
test('reconciliation role gate does not expose privileged ledger',()=>{
  assert.match(sql,/REVOKE ALL ON FUNCTION/)
  assert.match(sql,/FROM PUBLIC,anon,service_role/)
  assert.match(sql,/TO authenticated/)
  assert.doesNotMatch(sql,/GRANT (SELECT|UPDATE|INSERT|DELETE)|CREATE POLICY|correlate_evo_store_provider_order\(/)
})
