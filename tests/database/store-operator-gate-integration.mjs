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
    await psql([],await readFile(migration,'utf8'))
    for(const [role,id] of Object.entries(ids)){
      await psql([], `INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
        VALUES ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','operator-${role}@example.test','',now(),now());
        INSERT INTO public.profiles(id,username) VALUES('${id}','operator_${role}');
        ${role==='customer'?'':`INSERT INTO public.user_roles(user_id,role_id) SELECT '${id}',id FROM public.roles WHERE code='${role}';`}`)
    }
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
    await psql([], `DELETE FROM public.user_roles WHERE user_id='${ids.admin}'`)
    assert.equal(await evaluate('authenticated',ids.admin),'f')
    assert.equal(await evaluate('authenticated',ids.super_admin),'t')
    assert.equal(query("SELECT count(*) FROM public.payments"),'0')
  })
}
