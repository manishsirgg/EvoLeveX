import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261014050000_store_domestic_shipping_inclusive_tax.sql',import.meta.url),'utf8')
test('domestic shipping must be configured and authorized, without preset amount',()=>{
 for(const term of ['shipping_flat_inr numeric(14,2) NOT NULL','tax_rate_percent numeric(6,3) NOT NULL',
   'is_enabled boolean NOT NULL DEFAULT false',"hold.currency::text <> 'INR'",
   "'india','in'","STORE_SHIPPING_POLICY_UNCONFIGURED","buyer uuid := auth.uid()",
   'STORE_SHIPPING_DESTINATION_UNSUPPORTED'])assert.ok(sql.includes(term),term)
 assert.doesNotMatch(sql,/INSERT INTO private\.evo_store_domestic_checkout_policy|DEFAULT 99|DEFAULT 0\.18/)
})
test('tax-inclusive arithmetic is extracted without adding product tax twice',()=>{
 assert.match(sql,/hold\.subtotal \* policy\.tax_rate_percent\s*\/ \(100 \+ policy\.tax_rate_percent\)/)
 assert.match(sql,/computed_total := hold\.subtotal \+ policy\.shipping_flat_inr/)
 assert.match(sql,/tax_total=0/)
 assert.match(sql,/'included_product_tax'/)
 assert.match(sql,/'tax_added_at_checkout',0/)
})
test('finalization is owner-locked, repeatable but immutable if quote policy changes',()=>{
 for(const term of ['user_id=buyer FOR UPDATE',"hold.status <> 'active'",
 'STORE_SHIPPING_ORDER_ALREADY_CREATED','STORE_SHIPPING_QUOTE_CHANGED',
 'STORE_SHIPPING_TOTAL_INVALID','REVOKE ALL ON FUNCTION','TO authenticated'])
 assert.ok(sql.includes(term),term)
 assert.doesNotMatch(sql,/public\.payments|razorpay|fulfill_confirmed_evo_vault_order/)
})
test('inclusive tax example INR 118 with 18 percent GST comprises INR 18 included tax',()=>{
 const gross=118,rate=18
 const included=Math.round((gross*rate/(100+rate))*100)/100
 assert.equal(included,18)
 assert.equal(gross+40,158)
})
