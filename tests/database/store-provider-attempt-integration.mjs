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
export function registerStoreProviderAttemptIntegration(serialTest,{psql,query,resetDatabase}){
  serialTest('Store provider attempt: real PostgreSQL preparation, concurrency and fail-closed roles',async()=>{
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
      '20261015220000_store_provider_order_correlation.sql'
    ]) await psql([],await readFile(migration(name),'utf8'))
    await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname],'')
    const checkout=await invoke(psql,`public.create_evo_store_checkout('[{"variant_id":"${variant}","quantity":2}]'::jsonb,'USD','a9000000-0000-4000-8000-000000000935','${address}')`)
    await psql([],`INSERT INTO private.evo_store_global_shipping_rates(country_code,currency,flat_shipping,enabled) VALUES('IN','USD',7.25,true);
    INSERT INTO private.evo_store_merchant_delivery_eligibility(variant_id,country_code,enabled) VALUES('${variant}','IN',true);
    INSERT INTO private.evo_store_global_inclusive_tax_rules(country_code,variant_id,inclusive_rate_percent,enabled) VALUES('IN','${variant}',18,true);
    INSERT INTO private.evo_store_global_financial_clearances(country_code,currency,shipping_tax_reviewed,import_duties_reviewed,merchant_fulfillment_reviewed,payment_currency_reviewed,review_reference,enabled)
    VALUES('IN','USD',true,true,true,true,'SYNTHETIC-ONLY',true);
    INSERT INTO private.evo_store_merchant_final_charge_rules(country_code,currency,shipping_tax_amount,import_duties_amount,legal_review_reference,enabled)
    VALUES('IN','USD',1.25,0,'SYNTHETIC-ONLY',true);`)
    await invoke(psql,`public.snapshot_evo_store_global_quote('${checkout.id}')`)
    const order=await invoke(psql,`public.finalize_evo_store_merchant_order('${checkout.id}')`)
    const claim=await invoke(psql,`public.claim_evo_store_razorpay_intent('${order.order_id}','a9000000-0000-4000-8000-000000000936')`)
    const call=`SELECT private.prepare_evo_store_provider_attempt('${claim.intent_id}');`
    const attempts=await Promise.all([psql(['-Atq'],call,{capture:true}),psql(['-Atq'],call,{capture:true})])
    const results=attempts.map(s=>JSON.parse(s.trim().split('\n').find(l=>l.startsWith('{'))))
    assert.equal(results.filter(x=>x.created).length,1)
    assert.equal(results.filter(x=>!x.created).length,1)
    assert.equal(results[0].attempt_id,results[1].attempt_id)
    assert.equal(results[0].receipt,`evs_${claim.intent_id.replaceAll('-','')}`)
    assert.equal(results[0].dispatch_allowed,false)
    assert.equal(query('SELECT count(*) FROM private.evo_store_provider_order_attempts'),'1')
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    assert.equal(query(`SELECT status::text||':'||payment_status::text FROM public.orders WHERE id='${order.order_id}'`),'pending:pending')
    for(const role of ['anon','authenticated','service_role']){
      await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE ${role}; SELECT * FROM private.evo_store_provider_order_attempts; COMMIT;`,{capture:true}),/permission denied/)
      await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE ${role}; SELECT private.prepare_evo_store_provider_attempt('${claim.intent_id}'); COMMIT;`,{capture:true}),/permission denied/)
    }
    await assert.rejects(psql([], `UPDATE private.evo_store_provider_order_attempts SET provider_order_id='order_12345678' WHERE intent_id='${claim.intent_id}';`,{capture:true}),/store_attempt_state_consistency/)
    const flagged=JSON.parse((await psql(['-Atq'],`SELECT private.flag_evo_store_provider_attempt_uncertain('${results[0].attempt_id}');`,{capture:true})).trim())
    assert.equal(flagged.state,'dispatch_uncertain')
    assert.equal(flagged.dispatch_allowed,false)
    // PR #336: exercise the real owner-only dispatch claim on the full Store
    // payment schema. Existing attempt has already advanced to uncertain, so
    // this must fail without changing state or allowing a second POST.
    await psql([],await readFile(migration('20261025131500_store_provider_dispatch_atomic_claim.sql'),'utf8'))
    const duplicateClaim=await psql(['-Atq'],`SELECT private.claim_evo_store_provider_dispatch('${results[0].attempt_id}');`,{capture:true})
    assert.equal(duplicateClaim.trim(),'f')
    for(const role of ['anon','authenticated','service_role']){
      await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE ${role}; SELECT private.claim_evo_store_provider_dispatch('${results[0].attempt_id}'); COMMIT;`,{capture:true}),/permission denied/)
    }
    await assert.rejects(psql(['-Atq'],call,{capture:true}),/STORE_PROVIDER_ATTEMPT_LOCKED/)
    const locked=JSON.parse((await psql(['-Atq'],`SELECT private.require_evo_store_provider_reconciliation('${results[0].attempt_id}','Provider response is unknown; manual lookup required');`,{capture:true})).trim())
    assert.equal(locked.state,'reconciliation_required')
    assert.equal(locked.payment_ready,false)
    assert.equal(query(`SELECT state FROM private.evo_store_razorpay_intent_claims WHERE intent_id='${claim.intent_id}'`),'reconciliation_required')
    await assert.rejects(psql(['-Atq'],call,{capture:true}),/STORE_PROVIDER_INTENT_UNAVAILABLE/)
    await assert.rejects(psql([], `SELECT private.require_evo_store_provider_reconciliation('${results[0].attempt_id}','bad');`,{capture:true}),/STORE_PROVIDER_RECONCILIATION_NOTE_REQUIRED/)
    for(const role of ['anon','authenticated','service_role']){
      await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE ${role}; SELECT private.flag_evo_store_provider_attempt_uncertain('${results[0].attempt_id}'); COMMIT;`,{capture:true}),/permission denied/)
      await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE ${role}; SELECT private.require_evo_store_provider_reconciliation('${results[0].attempt_id}','Manually review provider'); COMMIT;`,{capture:true}),/permission denied/)
    }
    const correlate=(providerId,receipt=results[0].receipt,amount=29,currency='USD')=>`SELECT private.correlate_evo_store_provider_order('${results[0].attempt_id}','${providerId}','${receipt}',${amount},'${currency}');`
    await assert.rejects(psql(['-Atq'],correlate('order_12345678','incorrect'),{capture:true}),/STORE_PROVIDER_EVIDENCE_MISMATCH/)
    await assert.rejects(psql(['-Atq'],correlate('order_12345678',results[0].receipt,30),{capture:true}),/STORE_PROVIDER_EVIDENCE_MISMATCH/)
    await assert.rejects(psql(['-Atq'],correlate('order_12345678',results[0].receipt,29,'JPY'),{capture:true}),/STORE_PROVIDER_EVIDENCE_MISMATCH/)
    const correlated=JSON.parse((await psql(['-Atq'],correlate('order_12345678'),{capture:true})).trim())
    assert.equal(correlated.correlated,true)
    assert.equal(correlated.payment_ready,false)
    assert.equal(correlated.created,true)
    const replay=JSON.parse((await psql(['-Atq'],correlate('order_12345678'),{capture:true})).trim())
    assert.equal(replay.created,false)
    await assert.rejects(psql(['-Atq'],correlate('order_87654321'),{capture:true}),/STORE_PROVIDER_CORRELATION_CONFLICT/)
    for(const role of ['anon','authenticated','service_role']){
      await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE ${role}; ${correlate('order_12345678')} COMMIT;`,{capture:true}),/permission denied/)
    }
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    assert.equal(query(`SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant}'`),'2')
  })
}
