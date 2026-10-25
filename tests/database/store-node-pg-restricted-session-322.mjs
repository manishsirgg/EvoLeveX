import assert from 'node:assert/strict'
import pg from 'pg'
import {readFile} from 'node:fs/promises'
import {LOCAL_DATABASE_URL,LOCAL_DATABASE,validateDisposableTarget} from './helpers/local-target.mjs'

const ACTOR='32200000-0000-4000-8000-000000000001'
const OUTSIDER='32200000-0000-4000-8000-000000000002'
const LOOKUP='SELECT private.evo_store_operator_eligible_for_reconciliation($1::uuid) AS eligible'

// Exercise actual node-postgres startup/auth/query/close, not a mock driver.
// Strictly limited to the pinned disposable Supabase test container.
// This local fixture intentionally uses plaintext loopback; PR #321 separately
// verifies the node-postgres TLS negotiation and CA/hostname enforcement.
async function openReader(){
 validateDisposableTarget(LOCAL_DATABASE_URL,LOCAL_DATABASE.projectId)
 const client=new pg.Client({
  host:'127.0.0.1',port:55432,database:'postgres',
  user:'evo_reader_login_315',password:'disposable-only-315',
  ssl:false,connectionTimeoutMillis:3000,
  query_timeout:3000,statement_timeout:3000,
  application_name:'evo-store-disposable-pg-session-322',
 })
 await client.connect()
 return client
}
export function registerStoreNodePgRestrictedSession322(serialTest,{psql,resetDatabase}){
 serialTest('PR 322: restricted node-postgres session authenticates and enforces live grants',async()=>{
  await resetDatabase()
  validateDisposableTarget(LOCAL_DATABASE_URL,LOCAL_DATABASE.projectId)
  const fixture=await readFile(new URL('./fixtures/store-stable-private-reader-315.sql',import.meta.url),'utf8')
  await psql([],fixture)
  // The disposable baseline has the role schema but does not seed role rows.
  // Seed only the synthetic admin role needed by this isolated regression.
  await psql([], `INSERT INTO public.roles(id,code,name)
   VALUES ('b3220000-0000-4000-8000-000000000001','admin','Admin')
   ON CONFLICT (code) DO NOTHING;`)
  // Real test identities exist only in the just-reset local database.
  await psql([], `INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
   VALUES ('${ACTOR}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pg322-admin@example.test','',now(),now());
   INSERT INTO public.profiles(id,username) VALUES ('${ACTOR}','pg322_admin');
   INSERT INTO public.user_roles(user_id,role_id)
   SELECT '${ACTOR}'::uuid,id FROM public.roles WHERE code='admin';`)
  // Fail immediately on missing test prerequisites, rather than reporting
  // an ambiguous eligibility mismatch later inside the connected session.
  const assigned=await psql(['-Atq'],`SELECT count(*) FROM public.user_roles ur
   JOIN public.roles r ON r.id=ur.role_id
   WHERE ur.user_id='${ACTOR}'::uuid AND r.code='admin';`,{capture:true})
  assert.equal(assigned.trim(),'1','disposable fixture must assign exactly one admin role')
  let client
  try{
   client=await openReader()
   const identity=await client.query('SELECT current_user,session_user')
   assert.equal(identity.rows.length,1)
   assert.equal(identity.rows[0].current_user,'evo_reader_login_315')
   assert.equal(identity.rows[0].session_user,'evo_reader_login_315')
   assert.equal((await client.query(LOOKUP,[ACTOR])).rows[0].eligible,true)
   assert.equal((await client.query(LOOKUP,[OUTSIDER])).rows[0].eligible,false)
   await assert.rejects(client.query('SELECT * FROM public.user_roles LIMIT 1'),e=>e.code==='42501')
   await assert.rejects(client.query('SELECT * FROM public.evo_store_orders LIMIT 1'),e=>e.code==='42501')
   await assert.rejects(client.query('SET ROLE evo_reader_owner_315'),e=>e.code==='42501')
   // PR #323: a live LOGIN must not turn its function privilege into data
   // mutation or another PostgreSQL session identity.
   await assert.rejects(client.query('UPDATE public.user_roles SET role_id=role_id WHERE false'),e=>e.code==='42501')
   await assert.rejects(client.query('SET SESSION AUTHORIZATION postgres'),e=>e.code==='42501')
   assert.equal((await client.query('SELECT current_user')).rows[0].current_user,'evo_reader_login_315')
   // Verify actual server-side statement timeout, not just a pg config mock.
   const configuredTimeout=(await client.query('SHOW statement_timeout')).rows[0].statement_timeout
   assert.match(configuredTimeout,/^3s$|^3000ms$/)
   await client.query("SET statement_timeout='150ms'")
   await assert.rejects(client.query('SELECT pg_sleep(2)'),e=>e.code==='57014')
   assert.equal((await client.query(LOOKUP,[ACTOR])).rows[0].eligible,true)

   // Admin status must be read afresh rather than cached.
   await psql([],`DELETE FROM public.user_roles WHERE user_id='${ACTOR}'::uuid
    AND role_id IN (SELECT id FROM public.roles WHERE code='admin');`)
   assert.equal((await client.query(LOOKUP,[ACTOR])).rows[0].eligible,false)
  }finally{
   if(client)await client.end()
  }
 })
}
