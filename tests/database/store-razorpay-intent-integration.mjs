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
    // Race on the very first claim for this already-finalized order; no second active checkout.
    const firstRace = await Promise.allSettled([invoke(psql,c), invoke(psql,c)])
    assert.ok(firstRace.every(r => r.status === 'fulfilled'),
      JSON.stringify(firstRace.map(r => r.status === 'rejected' ? String(r.reason) : r.value)))
    const claims = firstRace.map(r => r.value)
    assert.equal(claims.filter(r => r.created === true).length, 1)
    assert.equal(claims.filter(r => r.created === false).length, 1)
    assert.equal(new Set(claims.map(r => r.intent_id)).size, 1)
    const first = claims.find(r => r.created === true)
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

    // Direct access must stay denied even when the caller can invoke the authenticated RPC.
    for (const role of ['anon','authenticated','service_role']) {
      const setRole = `SET LOCAL ROLE ${role};`
      await assert.rejects(psql([], `BEGIN; ${setRole} SELECT * FROM private.evo_store_razorpay_intent_claims; COMMIT;`, {capture:true}),
        /permission denied/)
      await assert.rejects(psql([], `BEGIN; ${setRole} UPDATE private.evo_store_razorpay_intent_claims SET state='closed' WHERE order_id='${order.order_id}'; COMMIT;`, {capture:true}),
        /permission denied/)
    }
    // The claim must not be replayed after a financial clearance is revoked.
    await psql([], "UPDATE private.evo_store_global_financial_clearances SET enabled=false WHERE country_code='IN' AND currency='USD'")
    await assert.rejects(invoke(psql,c), /STORE_PAYMENT_CLEARANCE_REVOKED/)
    await psql([], "UPDATE private.evo_store_global_financial_clearances SET enabled=true WHERE country_code='IN' AND currency='USD'")
    // A non-reserved claim state is never replayable; test on a synthetic claim only.
    await psql([], `UPDATE private.evo_store_razorpay_intent_claims SET state='reconciliation_required' WHERE order_id='${order.order_id}'`)
    await assert.rejects(invoke(psql,c), /STORE_INTENT_CONFLICT/)
    await psql([], `UPDATE private.evo_store_razorpay_intent_claims SET state='closed' WHERE order_id='${order.order_id}'`)
    await assert.rejects(invoke(psql,c), /STORE_INTENT_CONFLICT/)
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'2')
    // Rejections must remain read-only even if order/hold financial records are stale.
    const secondKeyRequests = await Promise.allSettled([
      invoke(psql, `public.claim_evo_store_razorpay_intent('${order.order_id}','${otherKey}')`),
      invoke(psql, `public.claim_evo_store_razorpay_intent('${order.order_id}','${otherKey}')`)
    ])
    assert.ok(secondKeyRequests.every(r => r.status === 'rejected'))
    assert.ok(secondKeyRequests.every(r => /STORE_INTENT_CONFLICT/.test(String(r.reason))))
    await psql([], `UPDATE private.evo_store_merchant_order_financial_snapshots
      SET payable_total=payable_total+1 WHERE order_id='${order.order_id}'`)
    await assert.rejects(invoke(psql,c), /STORE_PAYMENT_SNAPSHOT_CONFLICT/)
    await psql([], `UPDATE private.evo_store_merchant_order_financial_snapshots
      SET payable_total=payable_total-1 WHERE order_id='${order.order_id}'`)
    await psql([], `UPDATE public.orders SET checkout_expires_at=now()-interval '1 second'
      WHERE id='${order.order_id}'`)
    await psql([], `UPDATE public.evo_store_checkouts SET expires_at=created_at+interval '1 millisecond'
      WHERE id='${hold.id}'`)
    await assert.rejects(invoke(psql,c), /STORE_PAYMENT_ORDER_UNAVAILABLE|STORE_PAYMENT_HOLD_CONFLICT/)
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_razorpay_intent_claims WHERE order_id='${order.order_id}'`),'1')
    assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'2')
    // Restore an unexpired hold then exercise the supported release lifecycle.
    // Release must cancel linked pending order without consuming inventory.
    await psql([], `UPDATE public.evo_store_checkouts
      SET expires_at=created_at+interval '10 minutes'
      WHERE id='${hold.id}'`)
    await psql([], `UPDATE public.orders SET checkout_expires_at=(
      SELECT expires_at FROM public.evo_store_checkouts WHERE id='${hold.id}'
    ) WHERE id='${order.order_id}'`)
    assert.equal(query(`SELECT (o.checkout_expires_at=h.expires_at)::text
      FROM public.orders o JOIN private.evo_store_checkout_order_links l ON l.order_id=o.id
      JOIN public.evo_store_checkouts h ON h.id=l.checkout_id WHERE o.id='${order.order_id}'`),'true')
    await invoke(psql, `public.release_evo_store_checkout('${hold.id}')`)
    assert.equal(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${hold.id}'`),'released')
    assert.equal(query(`SELECT status::text FROM public.orders WHERE id='${order.order_id}'`),'cancelled')
    await assert.rejects(invoke(psql,c), /STORE_PAYMENT_ORDER_UNAVAILABLE|STORE_PAYMENT_HOLD_CONFLICT/)
    assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'0')
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    // Once cancelled, the same buyer must not reuse the outstanding intent.
    await psql([], `UPDATE public.orders SET status='cancelled', payment_status='failed'
      WHERE id='${order.order_id}'`)
    await assert.rejects(invoke(psql,c), /STORE_PAYMENT_ORDER_UNAVAILABLE/)
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_razorpay_intent_claims WHERE order_id='${order.order_id}'`),'1')
    // The old idempotency key remains owner-bound even after checkout release.
    const hold2 = await invoke(psql,
      `public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":1}]'::jsonb,'USD','a9000000-0000-4000-8000-000000000937','${address}')`)
    await invoke(psql, `public.snapshot_evo_store_global_quote('${hold2.id}')`)
    const order2 = await invoke(psql, `public.finalize_evo_store_merchant_order('${hold2.id}')`)
    assert.notEqual(order2.order_id, order.order_id)
    await assert.rejects(invoke(psql,
      `public.claim_evo_store_razorpay_intent('${order2.order_id}','${claimKey}')`),
      /duplicate key|unique constraint|STORE_INTENT_CONFLICT/)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_razorpay_intent_claims WHERE order_id='${order2.order_id}'`),'0')
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    await invoke(psql, `public.release_evo_store_checkout('${hold2.id}')`)

    // Synthetic JPY quote -> finalized financial snapshot -> intent claim.
    // Currency policy is fixture-only and never establishes provider capability.
    await psql([], `INSERT INTO private.evo_store_global_shipping_rates(country_code,currency,flat_shipping,enabled)
      VALUES ('IN','JPY',200,true);
      INSERT INTO private.evo_store_global_inclusive_tax_rules(country_code,variant_id,inclusive_rate_percent,enabled)
      VALUES ('IN','${variant}',0,true)
      ON CONFLICT (country_code,variant_id) DO UPDATE SET inclusive_rate_percent=0;
      INSERT INTO private.evo_store_global_financial_clearances(country_code,currency,shipping_tax_reviewed,import_duties_reviewed,merchant_fulfillment_reviewed,payment_currency_reviewed,review_reference,enabled)
      VALUES ('IN','JPY',true,true,true,true,'SYNTHETIC-JPY-ONLY',true);
      INSERT INTO private.evo_store_merchant_final_charge_rules(country_code,currency,shipping_tax_amount,import_duties_amount,legal_review_reference,enabled)
      VALUES ('IN','JPY',0,0,'SYNTHETIC-JPY-ONLY',true);`)
    const jpyHold = await invoke(psql,
      `public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":1}]'::jsonb,'JPY','a9000000-0000-4000-8000-000000000938','${address}')`)
    await invoke(psql, `public.snapshot_evo_store_global_quote('${jpyHold.id}')`)
    const jpyOrder = await invoke(psql, `public.finalize_evo_store_merchant_order('${jpyHold.id}')`)
    const jpyClaim = await invoke(psql,
      `public.claim_evo_store_razorpay_intent('${jpyOrder.order_id}','a9000000-0000-4000-8000-000000000939')`)
    assert.equal(jpyClaim.currency,'JPY')
    assert.equal(Number.isInteger(Number(jpyClaim.amount)),true)
    assert.ok(Number(jpyClaim.amount)>0)
    assert.equal(jpyClaim.provider_order_created,false)
    assert.equal(jpyClaim.payment_ready,false)
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')

  })
}
