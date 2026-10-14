import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const sql=await readFile(new URL('../supabase/migrations/20261014030000_store_pending_order_conversion.sql',import.meta.url),'utf8')

test('Store conversion has an ownership-bound one-to-one link and atomic data snapshots',()=>{
  for(const check of [
    'checkout_id uuid PRIMARY KEY', 'order_id uuid NOT NULL UNIQUE',
    'user_id=buyer FOR UPDATE', "hold.status <> 'active'",
    'hold.shipping_total IS NULL','hold.tax_total IS NULL','hold.grand_total IS NULL',
    'computed_subtotal <> hold.subtotal', 'INSERT INTO public.orders',
    'INSERT INTO public.order_items',"SELECT new_order,'store'",
    'INSERT INTO private.evo_store_checkout_order_links'
  ])assert.ok(sql.includes(check),check)
})

test('Store conversion only grants authenticated and does not create payment/fulfillment side effects',()=>{
  assert.match(sql,/SECURITY DEFINER SET search_path = ''/)
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.create_pending_evo_store_order\(uuid\) FROM PUBLIC, anon, service_role/)
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.create_pending_evo_store_order\(uuid\) TO authenticated/)
  assert.doesNotMatch(sql,/INSERT INTO public\.payments|reserve_razorpay_payment|fulfill_confirmed_evo_vault_order|Printful/i)
})
