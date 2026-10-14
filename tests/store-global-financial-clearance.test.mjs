import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261014090000_store_global_financial_clearance.sql',import.meta.url),'utf8')
test('financial clearance requires explicit independently reviewed policy for each destination/currency',()=>{
 for(const value of ['PRIMARY KEY(country_code,currency)','shipping_tax_reviewed boolean NOT NULL DEFAULT false','import_duties_reviewed boolean NOT NULL DEFAULT false','merchant_fulfillment_reviewed boolean NOT NULL DEFAULT false','payment_currency_reviewed boolean NOT NULL DEFAULT false','enabled boolean NOT NULL DEFAULT false','review_reference'])assert.ok(sql.includes(value),value)
 assert.doesNotMatch(sql,/INSERT INTO private\.evo_store_global_financial_clearances/)
})
test('checkout readiness requires authenticated owner fresh eligible quote and never claims payable',()=>{
 for(const value of ['user_id=buyer FOR UPDATE',"hold.status <> 'active'",'private.evo_store_global_quote_snapshots','public.preview_evo_store_global_checkout(hold.id)','STORE_FINANCIAL_STALE_QUOTE',"'quote_payable',false",'REVOKE ALL ON FUNCTION'])assert.ok(sql.includes(value),value)
 assert.doesNotMatch(sql,/UPDATE public\.evo_store_checkouts|INSERT INTO public\.orders|INSERT INTO public\.payments|createRazorpayOrder|fulfill_confirmed_evo_vault_order/)
})
