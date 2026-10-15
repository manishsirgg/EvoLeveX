import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = name => new URL('../../supabase/migrations/' + name, import.meta.url)
const user = '19000000-0000-4000-8000-000000000001'
const address = '99000000-0000-4000-8000-000000000001'
const variant = '59000000-0000-4000-8000-000000000001'
const identity = `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);`
const key = 'a9000000-0000-4000-8000-000000000932'
const claimKey = 'a9000000-0000-4000-8000-000000000933'
const otherKey = 'a9000000-0000-4000-8000-000000000934'

async function invoke(psql, expression, role = identity) {
  const output = await psql(['-Atq'], `BEGIN; ${role} SELECT ${expression}; COMMIT;`, {capture:true})
  const result = output.split('\n').find(line => line.trim().startsWith('{'))
  assert.ok(result, output)
  return JSON.parse(result)
}

export function registerStoreRazorpayIntentIntegration(serialTest, {psql, query, resetDatabase}) {
  serialTest('Store Razorpay intent: real DB owner, idempotence, concurrency and payment isolation', async () => {
    await resetDatabase()
    for (const name of [
      '20261014030000_store_pending_order_conversion.sql',
      '20261014040000_store_linked_order_expiry_guard.sql',
      '20261014060000_global_store_policy_preview.sql',
      '20261014070000_store_global_quote_snapshot.sql',
      '20261014080000_store_merchant_delivery_eligibility.sql',
      '20261014090000_store_global_financial_clearance.sql',
      '20261014100000_store_merchant_financial_finalization.sql',
      '20261015100000_store_payment_preflight.sql',
      '20261015110000_store_razorpay_intent_claim.sql'
    ]) await psql([], await readFile(migration(name), 'utf8'))
    await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname], '')
    const hold = await invoke(psql,
      `public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":2}]'::jsonb,'USD','${key}','${address}')`)
    assert.ok(hold.id)
    await psql([], `INSERT INTO private.evo_store_global_shipping_rates(country_code,currency,flat_shipping,enabled)
      VALUES ('IN','USD',7.25,true);
      INSERT INTO private.evo_store_merchant_delivery_eligibility(variant_id,country_code,enabled)
      VALUES ('${variant}','IN',true);
      INSERT INTO private.evo_store_global_inclusive_tax_rules(country_code,variant_id,inclusive_rate_percent,enabled)
      VALUES ('IN','${variant}',18,true);
      INSERT INTO private.evo_store_global_financial_clearances(country_code,currency,shipping_tax_reviewed,import_duties_reviewed,merchant_fulfillment_reviewed,payment_currency_reviewed,review_reference,enabled)
      VALUES ('IN','USD',true,true,true,true,'SYNTHETIC-ONLY',true);
      INSERT INTO private.evo_store_merchant_final_charge_rules(country_code,currency,shipping_tax_amount,import_duties_amount,legal_review_reference,enabled)
      VALUES ('IN','USD',1.25,0,'SYNTHETIC-ONLY',true);`)
    await invoke(psql, `public.snapshot_evo_store_global_quote('${hold.id}')`)
    const order = await invoke(psql,`public.finalize_evo_store_merchant_order('${hold.id}')`)
    assert.ok(order.order_id)
    const c = `public.claim_evo_store_razorpay_intent('${order.order_id}','${claimKey}')`
    const first = await invoke(psql,c)
    const again = await invoke(psql,c)
    assert.equal(first.created,true)
    assert.equal(again.created,false)
    assert.equal(first.intent_id,again.intent_id)
    assert.equal(first.amount,29)
    assert.equal(first.currency,'USD')
    assert.equal(first.payment_ready,false)
    assert.equal(first.provider_order_created,false)
    await assert.rejects(invoke(psql,`public.claim_evo_store_razorpay_intent('${order.order_id}','${otherKey}')`), /STORE_INTENT_CONFLICT/)
    await assert.rejects(invoke(psql,c,"SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000099',true);"), /STORE_PAYMENT_HOLD_NOT_FOUND/)
    await assert.rejects(invoke(psql,c,"SET LOCAL ROLE anon; SELECT set_config('request.jwt.claim.sub','',true);"), /permission denied|STORE_INTENT_AUTH_REQUIRED/)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_razorpay_intent_claims WHERE order_id='${order.order_id}'`),'1')
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    assert.equal(query(`SELECT status::text||':'||payment_status::text FROM public.orders WHERE id='${order.order_id}'`),'pending:pending')
    assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'2')
    const concurrent = await Promise.allSettled([invoke(psql,c), invoke(psql,c)])
    assert.ok(concurrent.every(result=>result.status==='fulfilled'), JSON.stringify(concurrent.map(r=>r.status==='rejected'?String(r.reason):r.value)))
    assert.ok(concurrent.every(r=>r.value.intent_id===first.intent_id))
    await assert.rejects(invoke(psql,c,"SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','',true);"), /STORE_INTENT_AUTH_REQUIRED|STORE_PAYMENT_AUTH_REQUIRED/)
  })
}
