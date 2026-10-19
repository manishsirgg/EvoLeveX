import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run} from './helpers/process.mjs'
import {LOCAL_DATABASE_URL,LOCAL_DATABASE,validateDisposableTarget} from './helpers/local-target.mjs'

/**
 * Disposable architecture test ONLY: trusted issuer creates one-use operator
 * admission ticket, restricted authenticated worker consumes it transactionally.
 * Issuer authentication and real role-table integration are NOT implemented.
 */
export function registerWorkerAuthorizationTicketIntegration(serialTest,{psql,resetDatabase}){
 serialTest('Store worker DB ticket: login binding, role revocation and replay are enforced in SQL',async()=>{
  await resetDatabase()
  validateDisposableTarget(LOCAL_DATABASE_URL,LOCAL_DATABASE.projectId)
  const role='evo_worker_ticket_test',password='synthetic-disposable-only'
  const operator='a1000000-0000-4000-8000-000000000001'
  const other='a1000000-0000-4000-8000-000000000002'
  const attempt='a1000000-0000-4000-8000-000000000003'
  const ticket=randomUUID(),revokedTicket=randomUUID(),wrongAttemptTicket=randomUUID()
  await psql([], `
    CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE SCHEMA test_store_ticket;
    REVOKE ALL ON SCHEMA test_store_ticket FROM PUBLIC;
    CREATE TABLE test_store_ticket.admin_roles(operator_id uuid PRIMARY KEY,allowed boolean NOT NULL);
    CREATE TABLE test_store_ticket.admissions(
      token uuid PRIMARY KEY,operator_id uuid NOT NULL,attempt_id uuid NOT NULL,
      expires_at timestamptz NOT NULL,used_at timestamptz
    );
    REVOKE ALL ON ALL TABLES IN SCHEMA test_store_ticket FROM PUBLIC;
    CREATE FUNCTION test_store_ticket.consume(p_token uuid,p_operator uuid,p_attempt uuid)
    RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
    DECLARE v_ticket test_store_ticket.admissions%rowtype;
    BEGIN
      IF session_user IS DISTINCT FROM 'evo_worker_ticket_test' THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_TEST_WORKER_LOGIN_DENIED';
      END IF;
      SELECT * INTO v_ticket FROM test_store_ticket.admissions
      WHERE token=p_token FOR UPDATE;
      IF NOT FOUND OR v_ticket.used_at IS NOT NULL
        OR v_ticket.expires_at<=pg_catalog.clock_timestamp()
        OR v_ticket.operator_id IS DISTINCT FROM p_operator
        OR v_ticket.attempt_id IS DISTINCT FROM p_attempt
        OR NOT EXISTS(SELECT 1 FROM test_store_ticket.admin_roles r
          WHERE r.operator_id=v_ticket.operator_id AND r.allowed IS TRUE FOR UPDATE)
      THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_TEST_TICKET_DENIED';
      END IF;
      UPDATE test_store_ticket.admissions SET used_at=pg_catalog.clock_timestamp()
        WHERE token=p_token;
      RETURN true;
    END;
    $body$;
    REVOKE ALL ON FUNCTION test_store_ticket.consume(uuid,uuid,uuid) FROM PUBLIC;
    GRANT USAGE ON SCHEMA test_store_ticket TO ${role};
    GRANT EXECUTE ON FUNCTION test_store_ticket.consume(uuid,uuid,uuid) TO ${role};
    INSERT INTO test_store_ticket.admin_roles VALUES ('${operator}',true),('${other}',false);
    INSERT INTO test_store_ticket.admissions(token,operator_id,attempt_id,expires_at)
    VALUES ('${ticket}','${operator}','${attempt}',now()+interval '10 minutes'),
      ('${revokedTicket}','${operator}','${attempt}',now()+interval '10 minutes'),
      ('${wrongAttemptTicket}','${operator}','${attempt}',now()+interval '10 minutes');
  `)
  const url=new URL(LOCAL_DATABASE_URL);url.username=role;url.password=password
  const worker=sql=>run('psql',[url.toString(),'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})
  await assert.rejects(worker(`SELECT * FROM test_store_ticket.admissions`),/permission denied/)
  await assert.rejects(worker(`INSERT INTO test_store_ticket.admissions VALUES ('${randomUUID()}','${operator}','${attempt}',now(),NULL)`),/permission denied/)
  await assert.rejects(psql([],`SELECT test_store_ticket.consume('${ticket}','${operator}','${attempt}')`,{capture:true}),/STORE_TEST_WORKER_LOGIN_DENIED/)
  await assert.rejects(worker(`SELECT test_store_ticket.consume('${ticket}','${other}','${attempt}')`),/STORE_TEST_TICKET_DENIED/)
  await assert.rejects(worker(`SELECT test_store_ticket.consume('${wrongAttemptTicket}','${operator}','${other}')`),/STORE_TEST_TICKET_DENIED/)
  const success=await worker(`BEGIN; SELECT set_config('request.jwt.claim.sub','${other}',true);
    SELECT test_store_ticket.consume('${ticket}','${operator}','${attempt}'); COMMIT;`)
  assert.match(success,/t/)
  await assert.rejects(worker(`SELECT test_store_ticket.consume('${ticket}','${operator}','${attempt}')`),/STORE_TEST_TICKET_DENIED/)
  await psql([],`UPDATE test_store_ticket.admin_roles SET allowed=false WHERE operator_id='${operator}'`)
  await assert.rejects(worker(`SELECT test_store_ticket.consume('${revokedTicket}','${operator}','${attempt}')`),/STORE_TEST_TICKET_DENIED/)
 })
}
