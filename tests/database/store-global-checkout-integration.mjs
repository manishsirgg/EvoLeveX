import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migration=name=>new URL('../../supabase/migrations/'+name,import.meta.url)
const user='19000000-0000-4000-8000-000000000001'
const address='99000000-0000-4000-8000-000000000001'
const variant='59000000-0000-4000-8000-000000000001'
const auth=`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);`
const invoke=async(psql,expression)=>{
 const result=await psql(['-Atq'],`BEGIN; ${auth} SELECT ${expression}; COMMIT;`,{capture:true})
 const line=result.split('\n').find(v=>v.trim().startsWith('{'))
 assert.ok(line,'RPC must emit JSON')
 return JSON.parse(line)
}
const reserve=(key)=>`public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":2}]'::jsonb,'USD','a9000000-0000-4000-8000-${String(key).padStart(12,'0')}','${address}')`
const preview=id=>`public.preview_evo_store_global_checkout('${id}'::uuid)`
const snapshot=id=>`public.snapshot_evo_store_global_quote('${id}'::uuid)`

export function registerGlobalCheckoutIntegration(serialTest,{psql,query,resetDatabase}){
 serialTest('Global dummy physical product quote: owner, configuration, immutable snapshot, and no payment',async()=>{
  await resetDatabase()
  for(const file of [
    '20261014030000_store_pending_order_conversion.sql',
    '20261014040000_store_linked_order_expiry_guard.sql',
    '20261014060000_global_store_policy_preview.sql',
    '20261014070000_store_global_quote_snapshot.sql',
    '20261014080000_store_merchant_delivery_eligibility.sql',
  ])await psql([],await readFile(migration(file),'utf8'))
  await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname],'')
  const hold=await invoke(psql,reserve(721))
  assert.ok(hold.id)
  await assert.rejects(invoke(psql,preview(hold.id)),/STORE_GLOBAL_DESTINATION_UNCONFIGURED/)
  assert.equal(query('SELECT count(*) FROM private.evo_store_global_quote_snapshots'),'0')
  await psql([],`INSERT INTO private.evo_store_global_shipping_rates(country_code,currency,flat_shipping,enabled)
    VALUES('IN','USD',7.25,true)`)
  await assert.rejects(invoke(psql,preview(hold.id)),/STORE_GLOBAL_VARIANT_DELIVERY_UNAVAILABLE/)
  await psql([],`INSERT INTO private.evo_store_merchant_delivery_eligibility
    (variant_id,country_code,enabled) VALUES('${variant}','IN',true)`)
  await assert.rejects(invoke(psql,preview(hold.id)),/STORE_GLOBAL_TAX_RULE_MISSING/)
  await psql([],`INSERT INTO private.evo_store_global_inclusive_tax_rules(country_code,variant_id,inclusive_rate_percent,enabled)
    VALUES('IN','${variant}',18,true)`)
  const quote=await invoke(psql,preview(hold.id))
  assert.equal(quote.quote_payable,false)
  assert.equal(quote.country,'IN')
  assert.equal(quote.currency,'USD')
  assert.equal(Number(quote.subtotal_tax_inclusive),20.5)
  assert.equal(Number(quote.included_product_tax),3.13)
  assert.equal(Number(quote.shipping_before_any_applicable_shipping_tax),7.25)
  assert.equal(quote.shipping_tax_status,'requires_external_validation')
  const saved=await invoke(psql,snapshot(hold.id))
  assert.deepEqual(saved,quote)
  assert.deepEqual(await invoke(psql,snapshot(hold.id)),quote)
  assert.equal(query(`SELECT count(*) FROM private.evo_store_global_quote_snapshots WHERE checkout_id='${hold.id}'`),'1')
  assert.equal(query(`SELECT product_included_tax::text||':'||shipping_amount::text FROM private.evo_store_global_quote_snapshots WHERE checkout_id='${hold.id}'`),'3.13:7.25')
  assert.equal(query('SELECT count(*) FROM public.orders'),'0')
  assert.equal(query('SELECT count(*) FROM public.payments'),'0')
  await assert.rejects(invoke(psql,`(SELECT row_to_json(x) FROM public.create_pending_evo_store_order('${hold.id}'::uuid) x)`),
    /STORE_ORDER_TOTALS_NOT_FINAL/)
  await psql([],`UPDATE private.evo_store_global_shipping_rates SET flat_shipping=8.25 WHERE country_code='IN' AND currency='USD'`)
  await assert.rejects(invoke(psql,snapshot(hold.id)),/STORE_GLOBAL_QUOTE_CHANGED/)
  assert.equal(query(`SELECT shipping_amount FROM private.evo_store_global_quote_snapshots WHERE checkout_id='${hold.id}'`),'7.25')
  await invoke(psql,`public.release_evo_store_checkout('${hold.id}')`)
  await assert.rejects(invoke(psql,snapshot(hold.id)),/STORE_GLOBAL_CHECKOUT_UNAVAILABLE/)
  assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'0')
 })
 serialTest('Global quote rejects owner mismatch and unsupported destination and respects currency',async()=>{
  const hold=await invoke(psql,reserve(722))
  await assert.rejects(psql([],`BEGIN; SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
    SELECT public.snapshot_evo_store_global_quote('${hold.id}'); COMMIT;`,{capture:true}),
    /STORE_GLOBAL_CHECKOUT_UNAVAILABLE/)
  await psql([],`UPDATE public.evo_store_checkouts SET shipping_country='Unsupported Destination' WHERE id='${hold.id}'`)
  await assert.rejects(invoke(psql,snapshot(hold.id)),/STORE_GLOBAL_COUNTRY_INVALID/)
  assert.equal(query('SELECT count(*) FROM private.evo_store_global_quote_snapshots'),'1')
  await invoke(psql,`public.release_evo_store_checkout('${hold.id}')`)
 })
}
