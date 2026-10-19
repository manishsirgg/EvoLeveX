import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {run} from './helpers/process.mjs'
import {LOCAL_DATABASE,LOCAL_DATABASE_URL,validateDisposableTarget} from './helpers/local-target.mjs'

/** Synthetic, disposable one-transaction ticket+nonce+correlation fixture. */
export function registerStoreTicketAtomicRollback(serialTest,{psql,query,resetDatabase}){
 serialTest('Store ticket, nonce and synthetic correlation commit or roll back together',async()=>{
  await resetDatabase()
  validateDisposableTarget(LOCAL_DATABASE_URL,LOCAL_DATABASE.projectId)
  const role='evo_atomic_worker_test',password='disposable-atomic-only'
  const operator='a1000000-0000-4000-8000-000000000001'
  const attempt='a1000000-0000-4000-8000-000000000002'
  const ticket=randomBytes(32).toString('hex'),nonce=randomBytes(16).toString('hex')
  const failingTicket=randomBytes(32).toString('hex'),failingNonce=randomBytes(16).toString('hex')
  await psql([], `
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE SCHEMA test_atomic_ticket;
    REVOKE ALL ON SCHEMA test_atomic_ticket FROM PUBLIC;
    CREATE TABLE test_atomic_ticket.roles(operator_id uuid PRIMARY KEY,allowed boolean NOT NULL);
    CREATE TABLE test_atomic_ticket.attempts(attempt_id uuid PRIMARY KEY,state text NOT NULL);
    CREATE TABLE test_atomic_ticket.tickets(hash bytea PRIMARY KEY,operator_id uuid NOT NULL,attempt_id uuid NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz);
    CREATE TABLE test_atomic_ticket.nonces(nonce text PRIMARY KEY);
    CREATE TABLE test_atomic_ticket.correlations(attempt_id uuid PRIMARY KEY,provider_order_id text NOT NULL);
    REVOKE ALL ON ALL TABLES IN SCHEMA test_atomic_ticket FROM PUBLIC;
    CREATE FUNCTION test_atomic_ticket.execute(p_ticket text,p_operator uuid,p_attempt uuid,p_nonce text,p_provider text)
    RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $execute$
    DECLARE v_ticket test_atomic_ticket.tickets%rowtype;
    BEGIN
      IF session_user IS DISTINCT FROM 'evo_atomic_worker_test'
        OR p_ticket !~ '^[0-9a-f]{64}$' OR p_nonce !~ '^[0-9a-f]{32}$'
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='TEST_ATOMIC_WORKER_DENIED'; END IF;
      SELECT * INTO v_ticket FROM test_atomic_ticket.tickets
        WHERE hash=extensions.digest(pg_catalog.decode(p_ticket,'hex'),'sha256') FOR UPDATE;
      IF NOT FOUND OR v_ticket.consumed_at IS NOT NULL OR v_ticket.expires_at<=pg_catalog.clock_timestamp()
        OR v_ticket.operator_id IS DISTINCT FROM p_operator OR v_ticket.attempt_id IS DISTINCT FROM p_attempt
        OR NOT EXISTS(SELECT 1 FROM test_atomic_ticket.roles r
          WHERE r.operator_id=v_ticket.operator_id AND r.allowed FOR UPDATE)
        OR NOT EXISTS(SELECT 1 FROM test_atomic_ticket.attempts a
          WHERE a.attempt_id=v_ticket.attempt_id AND a.state='reconciliation_required' FOR UPDATE)
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='TEST_ATOMIC_TICKET_DENIED'; END IF;
      UPDATE test_atomic_ticket.tickets SET consumed_at=pg_catalog.clock_timestamp() WHERE hash=v_ticket.hash;
      INSERT INTO test_atomic_ticket.nonces VALUES(p_nonce);
      INSERT INTO test_atomic_ticket.correlations VALUES(p_attempt,p_provider);
      RETURN true;
    END $execute$;
    REVOKE ALL ON FUNCTION test_atomic_ticket.execute(text,uuid,uuid,text,text) FROM PUBLIC;
    GRANT USAGE ON SCHEMA test_atomic_ticket TO ${role};
    GRANT EXECUTE ON FUNCTION test_atomic_ticket.execute(text,uuid,uuid,text,text) TO ${role};
    INSERT INTO test_atomic_ticket.roles VALUES ('${operator}',true);
    INSERT INTO test_atomic_ticket.attempts VALUES ('${attempt}','reconciliation_required');
    INSERT INTO test_atomic_ticket.tickets(hash,operator_id,attempt_id,expires_at)
    VALUES(extensions.digest(decode('${ticket}','hex'),'sha256'),'${operator}','${attempt}',now()+interval '5 minutes'),
      (extensions.digest(decode('${failingTicket}','hex'),'sha256'),'${operator}','${attempt}',now()+interval '5 minutes');
  `)
  const url=new URL(LOCAL_DATABASE_URL);url.username=role;url.password=password
  const invoke=sql=>run('psql',[url.toString(),'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})
  const exec=(t,n,p)=>`SELECT test_atomic_ticket.execute('${t}','${operator}','${attempt}','${n}','${p}')`
  await assert.rejects(invoke('SELECT * FROM test_atomic_ticket.tickets'),/permission denied/)
  await assert.rejects(invoke('SELECT * FROM test_atomic_ticket.correlations'),/permission denied/)
  // Invalid provider value causes a real constraint violation *after* ticket and nonce mutation.
  await assert.rejects(invoke(exec(failingTicket,failingNonce,null).replace("'null'","NULL")),/null value|not-null constraint/)
  assert.equal(query("SELECT count(*) FROM test_atomic_ticket.nonces"),'0')
  assert.equal(query("SELECT count(*) FROM test_atomic_ticket.correlations"),'0')
  assert.equal(query(`SELECT count(*) FROM test_atomic_ticket.tickets WHERE consumed_at IS NOT NULL`),'0')
  assert.match(await invoke(exec(ticket,nonce,'order_synthetic123')),/t/)
  assert.equal(query("SELECT count(*) FROM test_atomic_ticket.nonces"),'1')
  assert.equal(query("SELECT count(*) FROM test_atomic_ticket.correlations"),'1')
  await assert.rejects(invoke(exec(ticket,nonce,'order_synthetic123')),/TEST_ATOMIC_TICKET_DENIED/)
  const competing=await Promise.allSettled([
   invoke(exec(failingTicket,failingNonce,'order_second123')),
   invoke(exec(failingTicket,failingNonce,'order_second123'))
  ])
  assert.equal(competing.filter(x=>x.status==='fulfilled').length,0)
  assert.equal(query("SELECT count(*) FROM test_atomic_ticket.nonces"),'1')
 })
}
