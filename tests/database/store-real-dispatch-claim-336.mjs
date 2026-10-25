import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const migration=name=>new URL('../../supabase/migrations/'+name,import.meta.url)
const user='19000000-0000-4000-8000-000000000001'
const variant='59000000-0000-4000-8000-000000000001'
const address='99000000-0000-4000-8000-000000000001'
async function invoke(psql,sql){
 const output=await psql(['-Atq'],`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true); SELECT ${sql}; COMMIT;`,{capture:true})
 const data=output.split('\n').find(line=>line.trim().startsWith('{'))
 assert.ok(data,output)
 return JSON.parse(data)
}
export function registerStoreRealDispatchClaim336(serialTest,{psql,query,resetDatabase}){
 serialTest('PR 336: real Store provider dispatch claim is atomic and denies unprivileged callers',async()=>{
  await resetDatabase()
  for(const name of [
   '20261014030000_store_pending_order_conversion.sql',
   '20261014040000_store_linked_order_expiry_guard.sql',
   '20261014060000_global_store_policy_preview.sql',
   '20261014070000_store_global_quote_snapshot.sql',
   '20261014080000_store_merchant_delivery_eligibility.sql',
   '20261014090000_store_global_financial_clearance.sql',
   '20261014100000_store_merchant_financial_finalization.sql',
   '20261015100000_store_payment_preflight.sql',
   '20261015110000_store_razorpay_intent_claim.sql',
   '20261015200000_store_provider_order_attempt_preparation.sql',
   '20261015210000_store_provider_uncertain_reconciliation.sql',
   '20261015220000_store_provider_order_correlation.sql',
   '20261025131500_store_provider_dispatch_atomic_claim.sql',
  ])await psql([],await readFile(migration(name),'utf8'))
  await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname],'')
  const checkout=await invoke(psql,`public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":2}]'::jsonb,'USD','a9000000-0000-4000-8000-000000000937','${address}')`)
  await psql([],`INSERT INTO private.evo_store_global_shipping_rates(country_code,currency,flat_shipping,enabled) VALUES('IN','USD',7.25,true);
   INSERT INTO private.evo_store_merchant_delivery_eligibility(variant_id,country_code,enabled) VALUES('${variant}','IN',true);
   INSERT INTO private.evo_store_global_inclusive_tax_rules(country_code,variant_id,inclusive_rate_percent,enabled) VALUES('IN','${variant}',18,true);
   INSERT INTO private.evo_store_global_financial_clearances(country_code,currency,shipping_tax_reviewed,import_duties_reviewed,merchant_fulfillment_reviewed,payment_currency_reviewed,review_reference,enabled)
   VALUES('IN','USD',true,true,true,true,'SYNTHETIC-ONLY',true);
   INSERT INTO private.evo_store_merchant_final_charge_rules(country_code,currency,shipping_tax_amount,import_duties_amount,legal_review_reference,enabled)
   VALUES('IN','USD',1.25,0,'SYNTHETIC-ONLY',true);`)
  await invoke(psql,`public.snapshot_evo_store_global_quote('${checkout.id}')`)
  const order=await invoke(psql,`public.finalize_evo_store_merchant_order('${checkout.id}')`)
  const intent=await invoke(psql,`public.claim_evo_store_razorpay_intent('${order.order_id}','a9000000-0000-4000-8000-000000000938')`)
  const prepared=JSON.parse((await psql(['-Atq'],`SELECT private.prepare_evo_store_provider_attempt('${intent.intent_id}');`,{capture:true})).trim())
  assert.equal(prepared.state,'prepared')
  const call=`SELECT private.claim_evo_store_provider_dispatch('${prepared.attempt_id}');`
  const two=await Promise.all([psql(['-Atq'],call,{capture:true}),psql(['-Atq'],call,{capture:true})])
  assert.deepEqual(two.map(x=>x.trim()).sort(),['f','t'])
  assert.equal(query(`SELECT state FROM private.evo_store_provider_order_attempts WHERE attempt_id='${prepared.attempt_id}'`),'dispatch_uncertain')
  assert.equal((await psql(['-Atq'],call,{capture:true})).trim(),'f')
  assert.equal(query('SELECT count(*) FROM public.payments'),'0')
  assert.equal(query(`SELECT status::text||':'||payment_status::text FROM public.orders WHERE id='${order.order_id}'`),'pending:pending')
  for(const role of ['anon','authenticated','service_role']){
   await assert.rejects(psql([],`BEGIN; SET LOCAL ROLE ${role}; ${call} COMMIT;`,{capture:true}),/permission denied/)
  }
 })
}
