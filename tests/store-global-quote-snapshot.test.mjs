import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261014070000_store_global_quote_snapshot.sql',import.meta.url),'utf8')
test('global quote snapshot requires owner, active checkout, unfinalized totals',()=>{
 for(const token of ['auth.uid()','user_id=buyer FOR UPDATE',"hold.status <> 'active'",
  'hold.grand_total IS NOT NULL','hold.shipping_total IS NOT NULL','hold.tax_total IS NOT NULL',
  'evo_store_checkout_order_links','public.preview_evo_store_global_checkout(p_checkout_id)'])
  assert.ok(sql.includes(token),token)
})
test('snapshots cannot become payable, and policy drift blocks idempotent replay',()=>{
 for(const token of ["'quote_payable' IS DISTINCT FROM 'false'",
  "'shipping_tax_status' IS DISTINCT FROM 'requires_external_validation'",
  'prior.breakdown IS DISTINCT FROM quote','STORE_GLOBAL_QUOTE_CHANGED',
  'requires_external_validation','REVOKE ALL ON FUNCTION','TO authenticated'])
  assert.ok(sql.includes(token),token)
 assert.doesNotMatch(sql,/INSERT INTO public\.orders|INSERT INTO public\.payments|UPDATE public\.evo_store_checkouts|reserve_razorpay_payment/)
})
