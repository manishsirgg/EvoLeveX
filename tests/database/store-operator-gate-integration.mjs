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
    await psql([],await readFile(new URL('../../supabase/migrations/20261016180000_store_provider_exact_amount_read.sql',import.meta.url),'utf8'))
    await psql([],await readFile(new URL('../../supabase/migrations/20261016190000_store_uncertain_attempt_audited_read.sql',import.meta.url),'utf8'))
    await psql([],await readFile(new URL('../../supabase/migrations/20261016200000_store_provider_correlation_audit.sql',import.meta.url),'utf8'))
    await psql([],await readFile(new URL('../../supabase/migrations/20261016210000_store_correlation_replay_reservations.sql',import.meta.url),'utf8'))
    await psql([],await readFile(new URL('../../supabase/migrations/20261017080000_store_atomic_correlation_protocol.sql',import.meta.url),'utf8'))
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
    // Build a real synthetic checkout and finalized Store intent in disposable PostgreSQL.
    await psql(['-1','-f',new URL('./supabase/tests/fixtures_store_checkout.sql',import.meta.url).pathname],'')
    const buyer='19000000-0000-4000-8000-000000000001'
    const asBuyer=async expression=>{
      const out=await psql(['-Atq'],`BEGIN; SET LOCAL ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub','${buyer}',true);
        SELECT ${expression}; COMMIT;`,{capture:true})
      const line=out.split('\n').find(s=>s.trim().startsWith('{'))
      assert.ok(line,out)
      return JSON.parse(line)
    }
    const hold=await asBuyer(`public.create_evo_store_checkout('[{"variant_id":"59000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,'USD','a9000000-0000-4000-8000-000000000937','99000000-0000-4000-8000-000000000001')`)
    await psql([], `INSERT INTO private.evo_store_global_shipping_rates(country_code,currency,flat_shipping,enabled) VALUES ('IN','USD',7.25,true);
      INSERT INTO private.evo_store_merchant_delivery_eligibility(variant_id,country_code,enabled) VALUES('59000000-0000-4000-8000-000000000001','IN',true);
      INSERT INTO private.evo_store_global_inclusive_tax_rules(country_code,variant_id,inclusive_rate_percent,enabled)
        VALUES('IN','59000000-0000-4000-8000-000000000001',18,true);
      INSERT INTO private.evo_store_global_financial_clearances(country_code,currency,shipping_tax_reviewed,import_duties_reviewed,merchant_fulfillment_reviewed,payment_currency_reviewed,review_reference,enabled)
        VALUES('IN','USD',true,true,true,true,'SYNTHETIC-ONLY',true);
      INSERT INTO private.evo_store_merchant_final_charge_rules(country_code,currency,shipping_tax_amount,import_duties_amount,legal_review_reference,enabled)
        VALUES('IN','USD',1.25,0,'SYNTHETIC-ONLY',true);`)
    await asBuyer(`public.snapshot_evo_store_global_quote('${hold.id}')`)
    const order=await asBuyer(`public.finalize_evo_store_merchant_order('${hold.id}')`)
    const claim=await asBuyer(`public.claim_evo_store_razorpay_intent('${order.order_id}','a9000000-0000-4000-8000-000000000938')`)
    const prep=await psql(['-Atq'],`SELECT private.prepare_evo_store_provider_attempt('${claim.intent_id}');`,{capture:true})
    const attempt=JSON.parse(prep.trim())
    const read=async id=>{
      const out=await psql(['-Atq'],`BEGIN; SET LOCAL ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub','${id}',true);
        SELECT public.read_evo_store_provider_attempt_for_reconciliation('${attempt.attempt_id}'); COMMIT;`,{capture:true})
      return JSON.parse(out.split('\n').find(s=>s.trim().startsWith('{')))
    }
    const first=await read(ids.admin)
    assert.equal(first.attempt_id,attempt.attempt_id)
    assert.equal(first.intent_id,claim.intent_id)
    assert.equal(first.order_id,order.order_id)
    assert.equal(first.receipt,attempt.receipt)
    assert.equal(first.currency,'USD')
    assert.equal(first.amount,'29.00')
    assert.equal(first.payment_ready,false)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE operator_user_id='${ids.admin}' AND attempt_id='${attempt.attempt_id}'`),'1')
    const both=await Promise.all([read(ids.admin),read(ids.super_admin)])
    assert.equal(both[0].attempt_id,attempt.attempt_id)
    assert.equal(both[1].attempt_id,attempt.attempt_id)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE attempt_id='${attempt.attempt_id}'`),'3')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE operator_user_id='${ids.super_admin}'`),'1')
    await assert.rejects(deniedRead('authenticated',ids.editor),/STORE_RECONCILIATION_OPERATOR_DENIED/)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE attempt_id='${attempt.attempt_id}'`),'3')
    // PR #299: deny-by-default contract is not executable by regular app principals.
    await psql([],await readFile(new URL('./fixtures/store-reader-contract-299.sql',import.meta.url),'utf8'))
    for(const appRole299 of ['anon','authenticated','service_role']){
      await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE ${appRole299};
        SELECT test_stage_reader_299.eligible('${ids.admin}'); COMMIT;`,{capture:true}),/permission denied/)
    }
    assert.equal(query(`SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='test_stage_reader_299' AND p.proname='eligible'
        AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')`),'0')
    // PR #309: separate NOLOGIN definer with SELECT-only role-table privileges.
    await psql([],await readFile(new URL('./fixtures/store-staging-role-owner-309.sql',import.meta.url),'utf8'))
    const reader309='postgresql://evo_stage_reader_login_309:disposable-reader-309@127.0.0.1:55432/postgres'
    const {run:run309}=await import('./helpers/process.mjs')
    const asReader309=sql=>run309('psql',[reader309,'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})
    assert.equal(query(`SELECT count(*) FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename IN ('user_roles','roles')
        AND policyname IN ('evo_stage_reader_owner_309_user_roles_read','evo_stage_reader_owner_309_roles_read')
        AND roles=ARRAY['evo_stage_reader_owner_309']::name[]`),'2')
    assert.equal((await asReader309(`SELECT test_stage_reader_309.eligible('${ids.admin}')`)).trim(),'t')
    assert.equal((await asReader309(`SELECT test_stage_reader_309.eligible('${ids.editor}')`)).trim(),'f')
    await assert.rejects(asReader309('SELECT * FROM public.user_roles'),/permission denied/)
    await assert.rejects(asReader309('SELECT * FROM public.payments'),/permission denied/)
    await assert.rejects(asReader309('SET ROLE evo_stage_reader_owner_309'),/permission denied/)
    await assert.rejects(asReader309('SELECT * FROM private.evo_store_provider_order_attempts'),/permission denied/)
    await psql([], `DELETE FROM public.user_roles WHERE user_id='${ids.admin}'`)
    assert.equal((await asReader309(`SELECT test_stage_reader_309.eligible('${ids.admin}')`)).trim(),'f')
    await psql([], `INSERT INTO public.user_roles(user_id,role_id) SELECT '${ids.admin}',id FROM public.roles WHERE code='admin'`)
    assert.equal((await asReader309(`SELECT test_stage_reader_309.eligible('${ids.admin}')`)).trim(),'t')
    assert.equal(query(`SELECT count(*) FROM pg_catalog.pg_roles
      WHERE rolname='evo_stage_reader_owner_309' AND rolcanlogin`),'0')

    // PR #310: security audit of function owner, RLS and schema boundaries.
    assert.equal(query(`SELECT count(*) FROM pg_catalog.pg_roles WHERE
      rolname IN ('evo_stage_reader_owner_309','evo_stage_reader_login_309')
      AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)`),'0')
    assert.equal(query(`SELECT count(*) FROM pg_catalog.pg_auth_members m
      JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid
      JOIN pg_catalog.pg_roles child ON child.oid=m.member
      WHERE parent.rolname='evo_stage_reader_owner_309'
        AND child.rolname='evo_stage_reader_login_309'`),'0')
    assert.equal(query(`SELECT count(*) FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
      WHERE n.nspname='test_stage_reader_309' AND p.proname='eligible'
        AND owner.rolname='evo_stage_reader_owner_309' AND p.prosecdef
        AND p.proconfig @> ARRAY['search_path=']::text[]`),'1')
    for(const unwanted of ['anon','authenticated','service_role']){
      assert.equal(query(`SELECT pg_catalog.has_function_privilege('${unwanted}',
        'test_stage_reader_309.eligible(uuid)','EXECUTE')`),'f')
    }
    await assert.rejects(asReader309('CREATE TABLE test_stage_reader_309.rogue(id integer)'),/permission denied/)
    await assert.rejects(asReader309('CREATE FUNCTION test_stage_reader_309.rogue() RETURNS boolean LANGUAGE sql AS \'SELECT true\''),/permission denied/)
    await assert.rejects(asReader309('ALTER FUNCTION test_stage_reader_309.eligible(uuid) SECURITY INVOKER'),/must be owner|permission denied/)
    await assert.rejects(asReader309('UPDATE public.user_roles SET user_id=user_id'),/permission denied/)
    const claim310=await asReader309(`BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      SELECT test_stage_reader_309.eligible('${ids.editor}');
      COMMIT;`)
    assert.equal(claim310.trim().split('\\n').filter(v=>v==='t'||v==='f').at(-1),'f')

    // PR #296: only a BOOLEAN role-eligibility function is exposed to this login.
    await psql([],await readFile(new URL('./fixtures/store-role-reader-296.sql',import.meta.url),'utf8'))
    const readerUrl296='postgresql://evo_store_role_reader_296:disposable-reader-296@127.0.0.1:55432/postgres'
    const {run:run296}=await import('./helpers/process.mjs')
    const asReader296=sql=>run296('psql',[readerUrl296,'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})

    // PR #303: actual Node pg driver against disposable PostgreSQL only.
    const {default:pg303}=await import('pg')
    const connect303=()=>new pg303.Client({
      connectionString:readerUrl296,
      connectionTimeoutMillis:3000,
      query_timeout:3000,
      statement_timeout:250,
      application_name:'evo-store-disposable-node-driver-303',
    })
    const client303=connect303()
    try{
      await client303.connect()
      const identity303=await client303.query(
        'SELECT current_user AS who, session_user AS login'
      )
      assert.equal(identity303.rows[0].who,'evo_store_role_reader_296')
      assert.equal(identity303.rows[0].login,'evo_store_role_reader_296')
      const eligible303=await client303.query(
        'SELECT test_role_reader_296.eligible($1::uuid) AS eligible',[ids.admin]
      )
      assert.equal(eligible303.rows[0].eligible,true)
      const disallowed303=await client303.query(
        'SELECT test_role_reader_296.eligible($1::uuid) AS eligible',[ids.editor]
      )
      assert.equal(disallowed303.rows[0].eligible,false)
      await assert.rejects(client303.query('SELECT * FROM public.payments'),/permission denied/)
      await assert.rejects(client303.query('SELECT pg_catalog.pg_sleep(1)'),/statement timeout|canceling statement/)
    }finally{
      await client303.end()
    }
    const afterClose303=connect303()
    try{
      await afterClose303.connect()
      assert.equal((await afterClose303.query('SELECT 1 AS alive')).rows[0].alive,1)
    }finally{
      await afterClose303.end()
    }


    // PR #302: actual disposable PostgreSQL client process, not a mocked driver.
    // Local Supabase test endpoint uses plaintext loopback; never a production TLS claim.
    const readerSession302=sql=>run296('psql',[
      readerUrl296,'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql,
    ],{
      capture:true,
      env:{...process.env,PGCONNECT_TIMEOUT:'3',PGOPTIONS:'-c statement_timeout=250'},
    })
    const session302=await readerSession302(`SELECT current_user,session_user,
      current_setting('statement_timeout')`)
    assert.equal(session302.trim(),'evo_store_role_reader_296|evo_store_role_reader_296|250ms')
    const eligibility302=await readerSession302(`BEGIN READ ONLY;
      SELECT test_role_reader_296.eligible('${ids.admin}');
      COMMIT;`)
    assert.equal(eligibility302.trim().split('\n').filter(v=>v==='t'||v==='f').at(-1),'t')
    await assert.rejects(readerSession302('SELECT pg_catalog.pg_sleep(1)'),/statement timeout/)
    await assert.rejects(readerSession302('SELECT * FROM public.payments'),/permission denied/)

    // PR #298: reject privilege escalation and session claim impersonation.
    await assert.rejects(asReader296('SET ROLE postgres'),/permission denied/)
    await assert.rejects(asReader296('SET ROLE authenticated'),/permission denied/)
    await assert.rejects(asReader296('CREATE TABLE public.store_reader_escape(id integer)'),/permission denied/)
    await assert.rejects(asReader296(`CREATE FUNCTION public.store_reader_escape() RETURNS boolean LANGUAGE sql AS 'SELECT true'`),/permission denied/)
    await assert.rejects(asReader296('SELECT * FROM private.evo_store_correlation_execution_nonces'),/permission denied/)
    await assert.rejects(asReader296('SELECT * FROM private.evo_store_provider_correlation_audit'),/permission denied/)
    await assert.rejects(asReader296('SELECT * FROM public.payments'),/permission denied/)
    const spoofed296=await asReader296(`BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      SELECT test_role_reader_296.eligible('${ids.editor}'); COMMIT;`)
    assert.equal(spoofed296.trim().split('\n').filter(v=>v==='t'||v==='f').at(-1),'f')
    assert.equal((await asReader296(`SELECT test_role_reader_296.eligible('${ids.admin}')`)).trim(),'t')
    assert.equal((await asReader296(`SELECT test_role_reader_296.eligible('${ids.editor}')`)).trim(),'f')
    await assert.rejects(asReader296('SELECT * FROM public.user_roles'),/permission denied/)
    await assert.rejects(asReader296('SELECT * FROM public.roles'),/permission denied/)
    await assert.rejects(asReader296('SELECT * FROM private.evo_store_provider_order_attempts'),/permission denied/)
    await assert.rejects(asReader296("SELECT private.execute_evo_store_correlation_atomically(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)"),/permission denied/)
    await assert.rejects(asReader296("UPDATE public.user_roles SET user_id=user_id"),/permission denied/)
    await psql([], `DELETE FROM public.user_roles WHERE user_id='${ids.admin}'`)
    assert.equal((await asReader296(`SELECT test_role_reader_296.eligible('${ids.admin}')`)).trim(),'f')
    await psql([], `INSERT INTO public.user_roles(user_id,role_id) SELECT '${ids.admin}',id FROM public.roles WHERE code='admin'`)
    assert.equal((await asReader296(`SELECT test_role_reader_296.eligible('${ids.admin}')`)).trim(),'t')

    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    const readUncertain=async (role,id)=>{
      const out=await psql(['-Atq'],`BEGIN; SET LOCAL ROLE ${role};
        SELECT set_config('request.jwt.claim.sub','${id}',true);
        SELECT public.read_evo_store_uncertain_attempt_for_reconciliation('${attempt.attempt_id}'); COMMIT;`,{capture:true})
      return JSON.parse(out.split('\n').find(s=>s.trim().startsWith('{')))
    }
    await assert.rejects(readUncertain('authenticated',ids.admin),/STORE_RECONCILIATION_UNCERTAIN_ATTEMPT_UNAVAILABLE/)
    for(const role of ['editor','moderator','support','customer']){
      await assert.rejects(readUncertain('authenticated',ids[role]),/STORE_RECONCILIATION_OPERATOR_DENIED/)
    }
    await assert.rejects(readUncertain('anon',ids.admin),/permission denied/)
    await assert.rejects(readUncertain('service_role',ids.admin),/permission denied/)
    await psql([], `SELECT private.flag_evo_store_provider_attempt_uncertain('${attempt.attempt_id}');`)
    const uncertain=await readUncertain('authenticated',ids.admin)
    assert.equal(uncertain.attempt_id,attempt.attempt_id)
    assert.equal(uncertain.intent_id,claim.intent_id)
    assert.equal(uncertain.order_id,order.order_id)
    assert.equal(uncertain.receipt,attempt.receipt)
    assert.equal(uncertain.amount,'29.00')
    assert.equal(uncertain.currency,'USD')
    assert.equal(uncertain.state,'dispatch_uncertain')
    assert.equal(uncertain.provider_order_id,null)
    assert.equal(uncertain.payment_ready,false)
    await psql([], `SELECT private.require_evo_store_provider_reconciliation('${attempt.attempt_id}','synthetic manual review required');`)
    const second=await readUncertain('authenticated',ids.super_admin)
    assert.equal(second.state,'reconciliation_required')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE attempt_id='${attempt.attempt_id}' AND action='read_uncertain'`),'2')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE operator_user_id='${ids.admin}' AND action='read_uncertain'`),'1')
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    // PR #285: real-schema authorization preflight, owner-only disposable SQL.
    const verifiedRealRole=(id)=>query(`SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
      WHERE ur.user_id='${id}' AND r.code IN ('admin','super_admin'))::text`)
    const realAttempt=()=>query(`SELECT state FROM private.evo_store_provider_order_attempts
      WHERE attempt_id='${attempt.attempt_id}'`)
    assert.equal(verifiedRealRole(ids.admin),'true')
    assert.equal(verifiedRealRole(ids.super_admin),'true')
    assert.equal(verifiedRealRole(ids.editor),'false')
    assert.equal(realAttempt(),'reconciliation_required')
    await psql([], `DELETE FROM public.user_roles WHERE user_id='${ids.super_admin}'`)
    assert.equal(verifiedRealRole(ids.super_admin),'false')
    await psql([], `INSERT INTO public.user_roles(user_id,role_id)
      SELECT '${ids.super_admin}',id FROM public.roles WHERE code='super_admin'`)
    assert.equal(verifiedRealRole(ids.super_admin),'true')
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')

    // PR #291: run a disposable restricted-login gate against real Store rows.
    await psql([],await readFile(new URL('./fixtures/store-real-ticket-291.sql',import.meta.url),'utf8'))
    const issuer291='postgresql://evo_issuer_291:disposable-issuer291@127.0.0.1:55432/postgres'
    const worker291='postgresql://evo_worker_291:disposable-worker291@127.0.0.1:55432/postgres'
    const {run:localRun291}=await import('./helpers/process.mjs')
    const login291=(url,sql)=>localRun291('psql',[url,'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})
    const operator291=ids.admin,attempt291=attempt.attempt_id
    const ticket291='a'.repeat(64)
    const issue291=`SELECT test_real_291.issue('${ticket291}','${operator291}','${attempt291}')`
    const consume291=`SELECT test_real_291.consume('${ticket291}','${operator291}','${attempt291}')`
    await assert.rejects(login291(worker291,issue291),/permission denied/)
    await assert.rejects(login291(issuer291,consume291),/permission denied/)
    assert.match(await login291(issuer291,issue291),/t/)
    assert.match(await login291(worker291,consume291),/t/)
    await assert.rejects(login291(worker291,consume291),/TEST_REAL_TICKET_DENIED/)
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')

    const freshStamp=query("SELECT (now()-interval '2 seconds')::text")
    const freshNonce='abcdefabcdefabcdefabcdefabcdefab'
    const reserveFresh=async()=>psql(['-Atq'],`BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      SELECT private.reserve_evo_store_correlation_nonce(
       '${freshNonce}','${ids.admin}','${attempt.attempt_id}',
       '${freshStamp}'::timestamptz,'${freshStamp}'::timestamptz); COMMIT;`,{capture:true})
    const concurrent=await Promise.allSettled([reserveFresh(),reserveFresh()])
    assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1)
    assert.equal(concurrent.filter(x=>x.status==='rejected' && /STORE_EXECUTION_NONCE_REPLAYED/.test(String(x.reason))).length,1)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_correlation_execution_nonces WHERE nonce='${freshNonce}'`),'1')
    await assert.rejects(psql([], `BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      SELECT private.reserve_evo_store_correlation_nonce(
       'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','${ids.admin}','${attempt.attempt_id}',
       now()-interval '2 minutes',now()-interval '2 minutes'); COMMIT;`,{capture:true}),/STORE_EXECUTION_NONCE_INVALID_OR_EXPIRED/)
    // PR #292 disposable owner-orchestrated ticket + real Store transaction proof.
    // Only the database owner performs the ticket mutation and real correlation.
    const rejectedTicket292='c'.repeat(64)
    const acceptedTicket292='d'.repeat(64)
    for(const token of [rejectedTicket292,acceptedTicket292]){
      assert.match(await login291(issuer291,`SELECT test_real_291.issue('${token}','${operator291}','${attempt291}')`),/t/)
    }
    const consumeOwner292=(token)=>`UPDATE test_real_291.tickets SET used=true
      WHERE hash=extensions.digest(decode('${token}','hex'),'sha256')
        AND operator_id='${ids.admin}' AND attempt_id='${attempt.attempt_id}'
        AND used=false RETURNING used;`
        // Invalid evidence must roll back the nonce inserted in the same transaction.
    const atomicNonce='feedfeedfeedfeedfeedfeedfeedfeed'
    await assert.rejects(psql([], `BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      ${consumeOwner292(rejectedTicket292)}
      SELECT private.execute_evo_store_correlation_atomically(
      '${atomicNonce}','${ids.admin}','${attempt.attempt_id}',
      now()-interval '2 seconds',now()-interval '1 second',
      'order_1234567890','${attempt.receipt}',30.00,'USD'); COMMIT;`,{capture:true}),/STORE_PROVIDER_EVIDENCE_MISMATCH/)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_correlation_execution_nonces WHERE nonce='${atomicNonce}'`),'0')
    assert.equal(query(`SELECT used FROM test_real_291.tickets WHERE hash=extensions.digest(decode('${rejectedTicket292}','hex'),'sha256')`),'f')
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated;
      SELECT private.execute_evo_store_correlation_atomically(
        '${atomicNonce}','${ids.admin}','${attempt.attempt_id}',now(),now(),
        'order_1234567890','${attempt.receipt}',29.00,'USD'); COMMIT;`,{capture:true}),/permission denied/)
    const providerId='order_1234567890'
    const correlateAs=async id=>{
      const out=await psql(['-Atq'],`BEGIN;
        SELECT set_config('request.jwt.claim.sub','${id}',true);
        SELECT private.record_evo_store_verified_provider_correlation(
          '${attempt.attempt_id}','${providerId}','${attempt.receipt}',29.00,'USD'); COMMIT;`,{capture:true})
      return JSON.parse(out.split('\n').find(s=>s.trim().startsWith('{')))
    }
    await assert.rejects(correlateAs(ids.editor),/STORE_CORRELATION_OPERATOR_DENIED/)
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated;
      SELECT private.record_evo_store_verified_provider_correlation(
        '${attempt.attempt_id}','${providerId}','${attempt.receipt}',29.00,'USD'); COMMIT;`,{capture:true}),/permission denied/)
    // PR #288: owner-only REAL Store atomic function; no restricted worker GRANT.
    const committedNonce='cafe'.repeat(8)
    // PR #289: actual Store owner-only atomic boundary denies a revoked actor
    // before any nonce reservation or provider-state mutation.
    const deniedNonce='dead'.repeat(8)
    await psql([], `DELETE FROM public.user_roles WHERE user_id='${ids.admin}'`)
    await assert.rejects(psql([], `BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      SELECT private.execute_evo_store_correlation_atomically(
        '${deniedNonce}','${ids.admin}','${attempt.attempt_id}',
        now()-interval '2 seconds',now()-interval '1 second',
        '${providerId}','${attempt.receipt}',29.00,'USD'); COMMIT;`,{capture:true}),
      /STORE_ATOMIC_CORRELATION_OPERATOR_DENIED/)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_correlation_execution_nonces
      WHERE nonce='${deniedNonce}'`),'0')
    assert.equal(query(`SELECT state FROM private.evo_store_provider_order_attempts
      WHERE attempt_id='${attempt.attempt_id}'`),'reconciliation_required')
    await psql([], `INSERT INTO public.user_roles(user_id,role_id)
      SELECT '${ids.admin}',id FROM public.roles WHERE code='admin'`)
    const atomicOut=await psql(['-Atq'],`BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      ${consumeOwner292(acceptedTicket292)}
      SELECT private.execute_evo_store_correlation_atomically(
        '${committedNonce}','${ids.admin}','${attempt.attempt_id}',
        now()-interval '2 seconds',now()-interval '1 second',
        '${providerId}','${attempt.receipt}',29.00,'USD'); COMMIT;`,{capture:true})
    const correlated=JSON.parse(atomicOut.split('\n').find(x=>x.trim().startsWith('{')))
    assert.equal(query(`SELECT used FROM test_real_291.tickets WHERE hash=extensions.digest(decode('${acceptedTicket292}','hex'),'sha256')`),'t')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_correlation_execution_nonces
      WHERE nonce='${committedNonce}' AND operator_user_id='${ids.admin}'
        AND attempt_id='${attempt.attempt_id}'`),'1')
    assert.equal(query(`SELECT state FROM private.evo_store_provider_order_attempts
      WHERE attempt_id='${attempt.attempt_id}'`),'correlated')
    await assert.rejects(psql([], `BEGIN;
      SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      SELECT private.execute_evo_store_correlation_atomically(
        '${committedNonce}','${ids.admin}','${attempt.attempt_id}',
        now()-interval '2 seconds',now()-interval '1 second',
        '${providerId}','${attempt.receipt}',29.00,'USD'); COMMIT;`,{capture:true}),
      /STORE_EXECUTION_ATTEMPT_UNAVAILABLE|STORE_EXECUTION_NONCE_REPLAYED/)
    assert.equal(correlated.correlated,true)
    assert.equal(correlated.created,true)
    assert.equal(correlated.payment_ready,false)
    const retry=await correlateAs(ids.super_admin)
    assert.equal(retry.created,false)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_correlation_audit WHERE attempt_id='${attempt.attempt_id}'`),'2')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_correlation_audit WHERE operator_user_id='${ids.admin}' AND outcome='created'`),'1')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_correlation_audit WHERE operator_user_id='${ids.super_admin}' AND outcome='idempotent'`),'1')
    await assert.rejects(psql([], `BEGIN; SELECT set_config('request.jwt.claim.sub','${ids.admin}',true);
      SELECT private.record_evo_store_verified_provider_correlation(
        '${attempt.attempt_id}','order_9876543210','${attempt.receipt}',29.00,'USD'); COMMIT;`,{capture:true}),/STORE_PROVIDER_CORRELATION_CONFLICT/)
    assert.equal(query('SELECT count(*) FROM private.evo_store_provider_correlation_audit'),'2')
    assert.equal(query('SELECT count(*) FROM public.payments'),'0')
    const stamp=query("SELECT (now()-interval '2 seconds')::text")
    const nonce='0123456789abcdef0123456789abcdef'
    const reserve=async (operator,id=nonce)=>psql(['-Atq'],`BEGIN;
      SELECT set_config('request.jwt.claim.sub','${operator}',true);
      SELECT private.reserve_evo_store_correlation_nonce(
        '${id}','${operator}','${attempt.attempt_id}',
        '${stamp}'::timestamptz,'${stamp}'::timestamptz); COMMIT;`,{capture:true})
    // This attempt is correlated now; nonce reservations must reject it.
    await assert.rejects(reserve(ids.admin),/STORE_EXECUTION_ATTEMPT_UNAVAILABLE/)
    await assert.rejects(reserve(ids.editor),/STORE_EXECUTION_OPERATOR_DENIED/)
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated;
      SELECT private.reserve_evo_store_correlation_nonce(
        '${nonce}','${ids.admin}','${attempt.attempt_id}',
        now(),now()); COMMIT;`,{capture:true}),/permission denied/)
    // Two successful nonce reservations: the earlier concurrency test and this atomic correlation.
    assert.equal(query('SELECT count(*) FROM private.evo_store_correlation_execution_nonces'),'2')
    await psql([], `DELETE FROM public.user_roles WHERE user_id='${ids.admin}'`)
    assert.equal(await evaluate('authenticated',ids.admin),'f')
    await assert.rejects(read(ids.admin),/STORE_RECONCILIATION_OPERATOR_DENIED/)
    await assert.rejects(readUncertain('authenticated',ids.admin),/STORE_RECONCILIATION_OPERATOR_DENIED/)
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE action='read_uncertain'`),'2')
    assert.equal(query(`SELECT count(*) FROM private.evo_store_provider_read_audit WHERE attempt_id='${attempt.attempt_id}'`),'5')
    assert.equal(await evaluate('authenticated',ids.super_admin),'t')
    assert.equal(query("SELECT count(*) FROM public.payments"),'0')
  })
}
