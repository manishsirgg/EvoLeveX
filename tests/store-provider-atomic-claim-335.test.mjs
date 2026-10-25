import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('production dispatch claim transitions prepared to uncertain once without public execution grants',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261025131500_store_provider_dispatch_atomic_claim.sql',import.meta.url),'utf8')
 for(const item of [
  'private.claim_evo_store_provider_dispatch(p_attempt_id uuid)',
  "attempt_row.state <> 'prepared'",
  "attempt_row.provider_order_id IS NOT NULL",
  "intent_row.state <> 'reserved'",
  "order_row.status <> 'pending'",
  "order_row.payment_status <> 'pending'",
  "order_row.checkout_expires_at <= pg_catalog.now()",
  "SET state = 'dispatch_uncertain'",
  "WHERE attempt_id = p_attempt_id AND state = 'prepared'",
  'RETURN FOUND',
  'FROM PUBLIC, anon, authenticated, service_role',
 ])assert.ok(sql.includes(item),item)
 assert.doesNotMatch(sql,/GRANT EXECUTE|http_post|net\.http|createRazorpayOrder|payment_ready\s*=\s*true/i)
})
