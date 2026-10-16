import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../../supabase/migrations/20261016090000_store_reconciliation_operator_gate.sql', import.meta.url)
const ids = {
  super_admin:'a1000000-0000-4000-8000-000000000001',
  admin:'a1000000-0000-4000-8000-000000000002',
  editor:'a1000000-0000-4000-8000-000000000003',
  moderator:'a1000000-0000-4000-8000-000000000004',
  support:'a1000000-0000-4000-8000-000000000005',
  customer:'a1000000-0000-4000-8000-000000000006',
}
export function registerStoreOperatorGateIntegration(serialTest,{psql,query,resetDatabase}){
  serialTest('Store reconciliation authorization: real PG role matrix and revocation',async()=>{
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
    ]) await psql([],await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'))
    await psql([],await readFile(migration,'utf8'))
    await psql([],await readFile(new URL('../../supabase/migrations/20261016100000_store_provider_trusted_read_audit.sql',import.meta.url),'utf8'))
    // The disposable baseline may contain role schema without seeded role definitions.
    // The INSERT ... SELECT below would otherwise silently assign zero roles.
    await psql([], `INSERT INTO public.roles(id,code,name)
      VALUES
      ('b1000000-0000-4000-8000-000000000001','super_admin','Super Admin'),
      ('b1000000-0000-4000-8000-000000000002','admin','Admin'),
      ('b1000000-0000-4000-8000-000000000003','editor','Editor'),
      ('b1000000-0000-4000-8000-000000000004','moderator','Moderator'),
      ('b1000000-0000-4000-8000-000000000005','support','Support')
      ON CONFLICT (code) DO NOTHING;`)
    assert.equal(query("SELECT count(*) FROM public.roles WHERE code IN ('super_admin','admin','editor','moderator','support')"),'5')
    for(const [role,id] of Object.entries(ids)){
      await psql([], `INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
        VALUES ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','operator-${role}@example.test','',now(),now());
        INSERT INTO public.profiles(id,username) VALUES('${id}','operator_${role}');
        ${role==='customer'?'':`INSERT INTO public.user_roles(user_id,role_id) SELECT '${id}',id FROM public.roles WHERE code='${role}';`}`)
    }
    assert.equal(query("SELECT count(*) FROM public.user_roles ur JOIN public.roles r ON ur.role_id=r.id WHERE r.code IN ('super_admin','admin','editor','moderator','support') AND ur.user_id IN ('" + Object.values(ids).join("','") + "')"),'5')
    const evaluate=async(role,id)=>{
      const text=await psql(['-Atq'],`BEGIN; SET LOCAL ROLE ${role};
        SELECT set_config('request.jwt.claim.sub','${id}',true);
        SELECT public.can_operate_evo_store_reconciliation(); COMMIT;`,{capture:true})
      return text.trim().split('\n').filter(x=>x==='t'||x==='f').at(-1)
    }
    for(const [role,id] of Object.entries(ids)){
      assert.equal(await evaluate('authenticated',id), ['super_admin','admin'].includes(role)?'t':'f',role)
    }
    const anon=await psql([], `BEGIN; SET LOCAL ROLE anon; SELECT public.can_operate_evo_store_reconciliation(); COMMIT;`,{capture:true}).then(()=>false,e=>/permission denied/.test(String(e)))
    assert.equal(anon,true)
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE service_role; SELECT public.can_operate_evo_store_reconciliation(); COMMIT;`,{capture:true}),/permission denied/)
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated; SELECT * FROM private.evo_store_razorpay_intent_claims; COMMIT;`,{capture:true}),/permission denied/)
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated; SELECT private.correlate_evo_store_provider_order(NULL,NULL,NULL,NULL,NULL); COMMIT;`,{capture:true}),/permission denied/)
    const deniedRead=(role,id)=>psql([], `BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${id}',true);
      SELECT public.read_evo_store_provider_attempt_for_reconciliation('a9000000-0000-4000-8000-000000000911'); COMMIT;`,{capture:true})
    for(const role of ['editor','moderator','support','customer']){
      await assert.rejects(deniedRead('authenticated',ids[role]),/STORE_RECONCILIATION_OPERATOR_DENIED/)
    }
    await assert.rejects(deniedRead('authenticated',ids.admin),/STORE_RECONCILIATION_ATTEMPT_NOT_FOUND/)
    await assert.rejects(deniedRead('authenticated',ids.super_admin),/STORE_RECONCILIATION_ATTEMPT_NOT_FOUND/)
    await assert.rejects(deniedRead('anon',ids.admin),/permission denied/)
    await assert.rejects(deniedRead('service_role',ids.admin),/permission denied/)
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated; SELECT * FROM private.evo_store_provider_read_audit; COMMIT;`,{capture:true}),/permission denied/)
    assert.equal(query('SELECT count(*) FROM private.evo_store_provider_read_audit'),'0')
    // A synthetic Store attempt is sufficient to exercise the read/audit RPC;
    // no provider API, financial clearance, payment or customer checkout is used.
    const attemptId='a2000000-0000-4000-8000-000000000001'
    const intentId='a2000000-0000-4000-8000-000000000002'
    const orderId='a2000000-0000-4000-8000-000000000003'
    // Fixture uses an existing auth user and a minimal Store order generated through the
    // proper checkout path in a subsequent test. The positive read fixture here is
    // created by cloning an actual Store checkout/intent from the provider test fixtures.
    await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname],'')
    const checkoutSql=`BEGIN; SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
      SELECT public.create_evo_store_checkout('[{"variant_id":"59000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,'USD','a9000000-0000-4000-8000-000000000937','99000000-0000-4000-8000-000000000001');
      COMMIT;`
    // Generate a valid Store provider attempt through existing finalization and claim
    // in a dedicated follow-up integration test; this test is intentionally not ready to merge.
    assert.ok(attemptId && intentId && orderId && checkoutSql)
    await psql([], `DELETE FROM public.user_roles WHERE user_id='${ids.admin}'`)
    assert.equal(await evaluate('authenticated',ids.admin),'f')
    assert.equal(await evaluate('authenticated',ids.super_admin),'t')
    assert.equal(query("SELECT count(*) FROM public.payments"),'0')
  })
}
