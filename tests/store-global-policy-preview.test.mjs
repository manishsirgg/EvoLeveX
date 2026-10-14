import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261014060000_global_store_policy_preview.sql',import.meta.url),'utf8')
test('global policy keys domestic and international quotes by destination AND selected currency',()=>{
  for(const value of ['country_code text NOT NULL',"currency IN ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')",
  'PRIMARY KEY (country_code,currency)',"currency <> 'JPY'","shipping_country",
  'STORE_GLOBAL_DESTINATION_UNCONFIGURED'])assert.ok(sql.includes(value),value)
})
test('product-inclusive tax is specific to destination and variant, with zero-decimal currency rounding',()=>{
  for(const value of ['PRIMARY KEY (country_code,variant_id)','inclusive_rate_percent',
   "expected_currency='JPY'","STORE_GLOBAL_TAX_RULE_MISSING",
   "'included_product_tax'","'items',lines"]) assert.ok(sql.includes(value),value)
})
test('quote function is read only with respect to orders, checkout totals, and payments',()=>{
  assert.match(sql,/RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/)
  assert.match(sql,/p_checkout_id AND user_id=buyer FOR UPDATE/)
  assert.match(sql,/'quote_payable',false/)
  assert.match(sql,/'shipping_tax_status','requires_external_validation'/)
  assert.doesNotMatch(sql,/UPDATE public\.evo_store_checkouts|INSERT INTO public\.orders|INSERT INTO public\.payments|reserve_razorpay_payment|finalize_evo_store_domestic_checkout\(/)
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.preview_evo_store_global_checkout\(uuid\) FROM PUBLIC,anon,service_role/)
})
test('no default shipping or tax policy records are seeded',()=>{
  assert.doesNotMatch(sql,/INSERT INTO private\.evo_store_global_shipping_rates|INSERT INTO private\.evo_store_global_inclusive_tax_rules/)
  assert.match(sql,/enabled boolean NOT NULL DEFAULT false/)
})
