import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {run} from './helpers/process.mjs'
import {LOCAL_DATABASE,LOCAL_DATABASE_URL,validateDisposableTarget} from './helpers/local-target.mjs'

/** Disposable-only staging authorization protocol: NEVER a production migration. */
export function registerStoreStagingAuthenticatedTransaction(serialTest,{psql,query,resetDatabase}){
 serialTest('authenticated issuer/worker enforce one-use ticket and atomic commit',async()=>{
  await resetDatabase()
  validateDisposableTarget(LOCAL_DATABASE_URL,LOCAL_DATABASE.projectId)
  const issuer='evo_stage_issuer_290',worker='evo_stage_worker_290'
  const operator='a1000000-0000-4000-8000-000000000001',attempt='a1000000-0000-4000-8000-000000000002'
  const ticket=randomBytes(32).toString('hex'),nonce=randomBytes(16).toString('hex')
  await psql([], `
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    CREATE ROLE ${issuer} LOGIN PASSWORD 'disposable-issuer-290' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE ROLE ${worker} LOGIN PASSWORD 'disposable-worker-290' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE SCHEMA test_stage_290;
    REVOKE ALL ON SCHEMA test_stage_290 FROM PUBLIC;
    CREATE TABLE test_stage_290.operators(id uuid PRIMARY KEY,allowed boolean NOT NULL);
    CREATE TABLE test_stage_290.attempts(id uuid PRIMARY KEY,state text NOT NULL);
    CREATE TABLE test_stage_290.tickets(digest bytea PRIMARY KEY,operator_id uuid NOT NULL,attempt_id uuid NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz);
    CREATE TABLE test_stage_290.nonces(value text PRIMARY KEY);
    CREATE TABLE test_stage_290.correlations(attempt_id uuid PRIMARY KEY,provider text NOT NULL);
    REVOKE ALL ON ALL TABLES IN SCHEMA test_stage_290 FROM PUBLIC;
    CREATE FUNCTION test_stage_290.issue(p_token text,p_operator uuid,p_attempt uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
    BEGIN
      IF session_user<>'evo_stage_issuer_290' OR p_token !~ '^[0-9a-f]{64}$'
        OR NOT EXISTS(SELECT 1 FROM test_stage_290.operators WHERE id=p_operator AND allowed=true FOR UPDATE)
        OR NOT EXISTS(SELECT 1 FROM test_stage_290.attempts WHERE id=p_attempt AND state='reconciliation_required' FOR UPDATE)
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STAGING_ISSUE_DENIED'; END IF;
      INSERT INTO test_stage_290.tickets VALUES(extensions.digest(decode(p_token,'hex'),'sha256'),
        p_operator,p_attempt,clock_timestamp()+interval '30 seconds',NULL);
      RETURN true;
    END $issue$;
    CREATE FUNCTION test_stage_290.execute(p_token text,p_operator uuid,p_attempt uuid,p_nonce text,p_provider text)
    RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $execute$
    DECLARE t test_stage_290.tickets%rowtype;
    BEGIN
      IF session_user<>'evo_stage_worker_290' OR p_token !~ '^[0-9a-f]{64}$'
        OR p_nonce !~ '^[0-9a-f]{32}$'
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STAGING_WORKER_DENIED'; END IF;
      SELECT * INTO t FROM test_stage_290.tickets WHERE digest=extensions.digest(decode(p_token,'hex'),'sha256') FOR UPDATE;
      IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at<=clock_timestamp()
        OR t.operator_id IS DISTINCT FROM p_operator OR t.attempt_id IS DISTINCT FROM p_attempt
        OR NOT EXISTS(SELECT 1 FROM test_stage_290.operators WHERE id=t.operator_id AND allowed=true FOR UPDATE)
        OR NOT EXISTS(SELECT 1 FROM test_stage_290.attempts WHERE id=t.attempt_id AND state='reconciliation_required' FOR UPDATE)
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STAGING_TICKET_DENIED'; END IF;
      UPDATE test_stage_290.tickets SET used_at=clock_timestamp() WHERE digest=t.digest;
      INSERT INTO test_stage_290.nonces VALUES(p_nonce);
      INSERT INTO test_stage_290.correlations VALUES(p_attempt,p_provider);
      RETURN true;
    END $execute$;
    REVOKE ALL ON FUNCTION test_stage_290.issue(text,uuid,uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION test_stage_290.execute(text,uuid,uuid,text,text) FROM PUBLIC;
    GRANT USAGE ON SCHEMA test_stage_290 TO ${issuer},${worker};
    GRANT EXECUTE ON FUNCTION test_stage_290.issue(text,uuid,uuid) TO ${issuer};
    GRANT EXECUTE ON FUNCTION test_stage_290.execute(text,uuid,uuid,text,text) TO ${worker};
    INSERT INTO test_stage_290.operators VALUES('${operator}',true);
    INSERT INTO test_stage_290.attempts VALUES('${attempt}','reconciliation_required');
  `)
  const connect=(role,password)=>{
   const url=new URL(LOCAL_DATABASE_URL);url.username=role;url.password=password
   return sql=>run('psql',[url.toString(),'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})
  }
  const issue=connect(issuer,'disposable-issuer-290'),workerExec=connect(worker,'disposable-worker-290')
  const issueSql=`SELECT test_stage_290.issue('${ticket}','${operator}','${attempt}')`
  const executeSql=`SELECT test_stage_290.execute('${ticket}','${operator}','${attempt}','${nonce}','order_stage290')`
  await assert.rejects(workerExec(issueSql),/permission denied/)
  await assert.rejects(issue(executeSql),/permission denied/)
  await assert.rejects(workerExec('SELECT * FROM test_stage_290.tickets'),/permission denied/)
  assert.match(await issue(issueSql),/t/)
  assert.match(await workerExec(executeSql),/t/)
  assert.equal(query('SELECT count(*) FROM test_stage_290.correlations'),'1')
  assert.equal(query('SELECT count(*) FROM test_stage_290.nonces'),'1')
  await assert.rejects(workerExec(executeSql),/STAGING_TICKET_DENIED/)
  await psql([], `UPDATE test_stage_290.operators SET allowed=false WHERE id='${operator}'`)
  await assert.rejects(issue(`SELECT test_stage_290.issue('${randomBytes(32).toString('hex')}','${operator}','${attempt}')`),/STAGING_ISSUE_DENIED/)
 })
}
