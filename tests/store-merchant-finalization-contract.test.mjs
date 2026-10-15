import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261014100000_store_merchant_financial_finalization.sql',import.meta.url),'utf8')
test('merchant payable order rejects unreviewed shipping tax and duties and does not seed arbitrary charges',()=>{
 for(const text of ['shipping_tax_amount numeric(14,2)','import_duties_amount numeric(14,2)',
   'enabled boolean NOT NULL DEFAULT false','legal_review_reference',
   "charges.import_duties_amount <> 0",'STORE_FINAL_CHARGES_UNSUPPORTED'])
 assert.ok(sql.includes(text),text)
 assert.doesNotMatch(sql,/INSERT INTO private\.evo_store_merchant_final_charge_rules/)
})
test('order and its item snapshots are finalized within one function and never initiate payments',()=>{
 for(const text of ['user_id=buyer FOR UPDATE',"hold.status <> 'active'",
  'private.evo_store_global_quote_snapshots','public.preview_evo_store_global_checkout(hold.id)',
  'STORE_FINAL_STALE_QUOTE','shipping_total=shipping, tax_total=charges.shipping_tax_amount',
  'public.create_pending_evo_store_order(hold.id)',
  'INSERT INTO private.evo_store_merchant_order_financial_snapshots',
  'charges.legal_review_reference',
  "subtotal + shipping + charges.shipping_tax_amount"])
 assert.ok(sql.includes(text),text)
 const executableSql=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n')
 assert.doesNotMatch(executableSql,/INSERT INTO public\.payments|razorpay\.open|fulfill_confirmed_evo_vault_order|Printful/i)
})
test('financial accounting does not double count included product tax',()=>{
 assert.match(sql,/subtotal := \(current_quote->>'subtotal_tax_inclusive'\)::numeric/)
 assert.match(sql,/included_tax := \(current_quote->>'included_product_tax'\)::numeric/)
 assert.match(sql,/total := subtotal \+ shipping \+ charges.shipping_tax_amount/)
 assert.doesNotMatch(sql,/total := subtotal \+ included_tax/)
})
