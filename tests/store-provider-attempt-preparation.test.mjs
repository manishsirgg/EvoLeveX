import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sql = await readFile(new URL('../supabase/migrations/20261015200000_store_provider_order_attempt_preparation.sql', import.meta.url),'utf8')

test('provider attempt is uniquely bound to intent, order and receipt',()=>{
  for (const expected of [
    'intent_id uuid PRIMARY KEY', 'order_id uuid NOT NULL UNIQUE',
    'attempt_id uuid NOT NULL UNIQUE', 'receipt text NOT NULL UNIQUE',
    'provider_order_id text UNIQUE', 'amount numeric(14,2) NOT NULL',
    'currency text NOT NULL', 'state <> \'prepared\'',
    "'dispatch_allowed',false"
  ]) assert.ok(sql.includes(expected),expected)
})
test('no payment activation or direct app roles access',()=>{
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/)
  assert.match(sql,/REVOKE ALL ON private\.evo_store_provider_order_attempts FROM PUBLIC, anon, authenticated, service_role/)
  assert.match(sql,/REVOKE ALL ON FUNCTION private\.prepare_evo_store_provider_attempt\(uuid\)/)
  assert.doesNotMatch(sql,/GRANT EXECUTE|https:\/\/api\.razorpay|createRazorpayOrder|public\.payments|Printful/i)
})
