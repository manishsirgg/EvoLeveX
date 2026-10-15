import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = file => new URL('../../supabase/migrations/' + file, import.meta.url)
const user='19000000-0000-4000-8000-000000000001'
const address='99000000-0000-4000-8000-000000000001'
const variant='59000000-0000-4000-8000-000000000001'
const auth=`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);`
const invoke=async(psql,expr)=>{
 const output=await psql(['-Atq'],`BEGIN; ${auth} SELECT ${expr}; COMMIT;`,{capture:true})
 const found=output.split('\n').find(line=>line.startsWith('{'))
 assert.ok(found,output)
 return JSON.parse(found)
}
export function registerMerchantFinalizationIntegration(serialTest,{psql,query,resetDatabase}){
 serialTest('Store merchant finalization: validated amount, order snapshots, retry and rollback',async()=>{
  await resetDatabase()
  for(const name of [
    '20261014030000_store_pending_order_conversion.sql',
    '20261014040000_store_linked_order_expiry_guard.sql',
    '20261014060000_global_store_policy_preview.sql',
    '20261014070000_store_global_quote_snapshot.sql',
    '20261014080000_store_merchant_delivery_eligibility.sql',
    '20261014090000_store_global_financial_clearance.sql',
    '20261014100000_store_merchant_financial_finalization.sql'
  ])await psql([],await readFile(migration(name),'utf8'))
  await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname],'')
  const hold=await invoke(psql,`public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":2}]'::jsonb,'USD','a9000000-0000-4000-8000-000000000931','${address}')`)
  const id=hold.id
  assert.ok(id)
  await psql([],`INSERT INTO private.evo_store_global_shipping_rates(country_code,currency,flat_shipping,enabled) VALUES ('IN','USD',7.25,true);
    INSERT INTO private.evo_store_merchant_delivery_eligibility(variant_id,country_code,enabled) VALUES ('${variant}','IN',true);
    INSERT INTO private.evo_store_global_inclusive_tax_rules(country_code,variant_id,inclusive_rate_percent,enabled) VALUES ('IN','${variant}',18,true);`)
  await invoke(psql,`public.snapshot_evo_store_global_quote('${id}')`)
  await assert.rejects(invoke(psql,`public.finalize_evo_store_merchant_order('${id}')`),/STORE_FINAL_CLEARANCE_REQUIRED/)
  assert.equal(query('SELECT count(*) FROM public.orders'),'0')
  await psql([],`INSERT INTO private.evo_store_global_financial_clearances(country_code,currency,shipping_tax_reviewed,import_duties_reviewed,merchant_fulfillment_reviewed,payment_currency_reviewed,review_reference,enabled)
    VALUES ('IN','USD',true,true,true,true,'SYNTHETIC-REVIEW-ONLY',true);
    INSERT INTO private.evo_store_merchant_final_charge_rules(country_code,currency,shipping_tax_amount,import_duties_amount,legal_review_reference,enabled)
    VALUES ('IN','USD',1.25,0,'SYNTHETIC-REVIEW-ONLY',true);`)
  const result=await invoke(psql,`public.finalize_evo_store_merchant_order('${id}')`)
  assert.equal(result.created,true)
  assert.equal(Number(result.amount),29)
  assert.equal(result.currency,'USD')
  assert.equal(query(`SELECT subtotal::text||':'||shipping_amount::text||':'||tax_amount::text||':'||total_amount::text FROM public.orders WHERE id='${result.order_id}'`),'20.50:7.25:1.25:29.00')
  assert.equal(query(`SELECT product_tax_included::text||':'||payable_total::text FROM private.evo_store_merchant_order_financial_snapshots WHERE order_id='${result.order_id}'`),'3.13:29.00')
  const again=await invoke(psql,`public.finalize_evo_store_merchant_order('${id}')`)
  assert.equal(again.order_id,result.order_id)
  assert.equal(again.created,false)
  assert.equal(query('SELECT count(*) FROM public.orders'),'1')
  assert.equal(query('SELECT count(*) FROM public.payments'),'0')
  assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'2')
  await assert.rejects(invoke(psql,`public.release_evo_store_checkout('${id}')`),/STORE_ORDER_RECONCILIATION_REQUIRED|STORE_ORDER_PROVIDER_RECONCILIATION_REQUIRED/)
 })
}
