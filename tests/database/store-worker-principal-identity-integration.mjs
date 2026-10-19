import assert from 'node:assert/strict'
import {run} from './helpers/process.mjs'
import {LOCAL_DATABASE_URL,LOCAL_DATABASE,validateDisposableTarget} from './helpers/local-target.mjs'

/** Runs only against disposable local Supabase PostgreSQL 15/17. */
export function registerWorkerPrincipalIdentityIntegration(serialTest,{psql,query,resetDatabase}){
 serialTest('Store worker principal: session identity cannot be forged with JWT claim GUC',async()=>{
  await resetDatabase()
  await psql([], `
    CREATE ROLE evo_worker_test NOLOGIN NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE ROLE evo_worker_other NOLOGIN NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    GRANT evo_worker_test, evo_worker_other TO postgres;
    CREATE SCHEMA IF NOT EXISTS test_worker_identity;
    REVOKE ALL ON SCHEMA test_worker_identity FROM PUBLIC;
    CREATE TABLE test_worker_identity.private_attempt (id bigint PRIMARY KEY);
    REVOKE ALL ON test_worker_identity.private_attempt FROM PUBLIC;
    CREATE FUNCTION test_worker_identity.report_identity()
    RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS
    $identity$ SELECT session_user::text || ':' || current_user::text $identity$;
    REVOKE ALL ON FUNCTION test_worker_identity.report_identity() FROM PUBLIC;
    GRANT USAGE ON SCHEMA test_worker_identity TO evo_worker_test,evo_worker_other;
    GRANT EXECUTE ON FUNCTION test_worker_identity.report_identity() TO evo_worker_test,evo_worker_other;
  `)
  const principal=await psql(['-Atq'],`BEGIN;
    SET LOCAL ROLE evo_worker_test;
    SELECT set_config('request.jwt.claim.sub','fake-administrator',true);
    SELECT test_worker_identity.report_identity();
    COMMIT;`,{capture:true})
  // SET ROLE is not proof of a worker LOGIN; session_user stays the DB login.
  assert.match(principal,/postgres:postgres/)
  assert.equal(query("SELECT rolsuper::text||':'||rolcreaterole::text||':'||rolbypassrls::text FROM pg_roles WHERE rolname='evo_worker_test'"),'false:false:false')
  await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated;
   SELECT test_worker_identity.report_identity(); COMMIT;`,{capture:true}),/permission denied/)
  await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE evo_worker_other;
   SELECT * FROM test_worker_identity.private_attempt; COMMIT;`,{capture:true}),/permission denied/)
  // A mutable JWT claim must not alter the verified login principal.
  const spoof=await psql(['-Atq'],`BEGIN; SET LOCAL ROLE evo_worker_other;
   SELECT set_config('request.jwt.claim.sub','admin-not-authenticated',true);
   SELECT session_user::text; COMMIT;`,{capture:true})
  assert.match(spoof,/postgres/)
 })
 serialTest('Store worker principal: real loopback LOGIN authenticates independent session_user',async()=>{
  await resetDatabase()
  validateDisposableTarget(LOCAL_DATABASE_URL,LOCAL_DATABASE.projectId)
  const role='evo_worker_login_test'
  const password='isolated-disposable-credential-only'
  await psql([], `
    CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE SCHEMA test_worker_login;
    REVOKE ALL ON SCHEMA test_worker_login FROM PUBLIC;
    CREATE TABLE test_worker_login.private_data (id bigint PRIMARY KEY);
    REVOKE ALL ON test_worker_login.private_data FROM PUBLIC;
    CREATE FUNCTION test_worker_login.report_login()
    RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS
    $identity$ SELECT session_user::text || ':' || current_user::text $identity$;
    REVOKE ALL ON FUNCTION test_worker_login.report_login() FROM PUBLIC;
    GRANT USAGE ON SCHEMA test_worker_login TO ${role};
    GRANT EXECUTE ON FUNCTION test_worker_login.report_login() TO ${role};
  `)
  const url=new URL(LOCAL_DATABASE_URL)
  url.username=role
  url.password=password
  const invoke=sql=>run('psql',[url.toString(),'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})
  const identity=await invoke(`SELECT test_worker_login.report_login();`)
  assert.equal(identity.trim(),role+':postgres')
  const spoof=await invoke(`BEGIN;
    SELECT set_config('request.jwt.claim.sub','forged-operator',true);
    SELECT test_worker_login.report_login(); COMMIT;`)
  assert.match(spoof, new RegExp(role+':postgres'))
  await assert.rejects(invoke('SELECT * FROM auth.users;'),/permission denied/)
  await assert.rejects(invoke('SELECT * FROM test_worker_login.private_data;'),/permission denied/)
  await assert.rejects(invoke('SELECT private.execute_evo_store_correlation_atomically(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);'),/permission denied|does not exist/)
 })

}
