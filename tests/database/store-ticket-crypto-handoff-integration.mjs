import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {run} from './helpers/process.mjs'
import {LOCAL_DATABASE,LOCAL_DATABASE_URL,validateDisposableTarget} from './helpers/local-target.mjs'

export function registerStoreTicketCryptoHandoff(serialTest,{psql,resetDatabase}){
 serialTest('Store ticket handoff: separate issuer/consumer logins, digest storage and expiration',async()=>{
  await resetDatabase()
  validateDisposableTarget(LOCAL_DATABASE_URL,LOCAL_DATABASE.projectId)
  const issuer='evo_ticket_issuer_test',worker='evo_ticket_consumer_test'
  const secretIssuer='disposable-issuer-only',secretWorker='disposable-consumer-only'
  const operator='a1000000-0000-4000-8000-000000000001'
  const attempt='a1000000-0000-4000-8000-000000000002'
  const token=randomBytes(32).toString('hex'),expired=randomBytes(32).toString('hex')
  const revoked=randomBytes(32).toString('hex')
  await psql([], `
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    CREATE ROLE ${issuer} LOGIN PASSWORD '${secretIssuer}' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE ROLE ${worker} LOGIN PASSWORD '${secretWorker}' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    CREATE SCHEMA test_ticket_handoff;
    REVOKE ALL ON SCHEMA test_ticket_handoff FROM PUBLIC;
    CREATE TABLE test_ticket_handoff.roles(operator_id uuid PRIMARY KEY,allowed boolean NOT NULL);
    CREATE TABLE test_ticket_handoff.tickets(
      ticket_hash bytea PRIMARY KEY CHECK(octet_length(ticket_hash)=32),
      operator_id uuid NOT NULL,attempt_id uuid NOT NULL,
      expires_at timestamptz NOT NULL,used_at timestamptz
    );
    REVOKE ALL ON ALL TABLES IN SCHEMA test_ticket_handoff FROM PUBLIC;
    CREATE FUNCTION test_ticket_handoff.issue(p_ticket text,p_operator uuid,p_attempt uuid,p_ttl_seconds integer)
    RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
    BEGIN
      IF session_user IS DISTINCT FROM 'evo_ticket_issuer_test'
        OR p_ticket !~ '^[0-9a-f]{64}$' OR p_operator IS NULL OR p_attempt IS NULL
        OR p_ttl_seconds IS NULL OR p_ttl_seconds NOT BETWEEN 1 AND 30
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_TEST_ISSUE_DENIED'; END IF;
      IF NOT EXISTS(SELECT 1 FROM test_ticket_handoff.roles r
         WHERE r.operator_id=p_operator AND r.allowed=true FOR UPDATE)
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_TEST_ISSUE_REVOKED'; END IF;
      INSERT INTO test_ticket_handoff.tickets(ticket_hash,operator_id,attempt_id,expires_at)
      VALUES(extensions.digest(pg_catalog.decode(p_ticket,'hex'),'sha256'),p_operator,p_attempt,
        pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>p_ttl_seconds));
      RETURN true;
    END $issue$;
    CREATE FUNCTION test_ticket_handoff.consume(p_ticket text,p_operator uuid,p_attempt uuid)
    RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $consume$
    DECLARE v_ticket test_ticket_handoff.tickets%rowtype;
    BEGIN
      IF session_user IS DISTINCT FROM 'evo_ticket_consumer_test' OR p_ticket !~ '^[0-9a-f]{64}$'
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_TEST_CONSUMER_DENIED'; END IF;
      SELECT * INTO v_ticket FROM test_ticket_handoff.tickets
        WHERE ticket_hash=extensions.digest(pg_catalog.decode(p_ticket,'hex'),'sha256') FOR UPDATE;
      IF NOT FOUND OR v_ticket.used_at IS NOT NULL OR v_ticket.expires_at<=pg_catalog.clock_timestamp()
        OR v_ticket.operator_id IS DISTINCT FROM p_operator OR v_ticket.attempt_id IS DISTINCT FROM p_attempt
        OR NOT EXISTS(SELECT 1 FROM test_ticket_handoff.roles r
           WHERE r.operator_id=v_ticket.operator_id AND r.allowed=true FOR UPDATE)
      THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_TEST_CONSUME_DENIED'; END IF;
      UPDATE test_ticket_handoff.tickets SET used_at=pg_catalog.clock_timestamp()
        WHERE ticket_hash=v_ticket.ticket_hash;
      RETURN true;
    END $consume$;
    REVOKE ALL ON FUNCTION test_ticket_handoff.issue(text,uuid,uuid,integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION test_ticket_handoff.consume(text,uuid,uuid) FROM PUBLIC;
    GRANT USAGE ON SCHEMA test_ticket_handoff TO ${issuer},${worker};
    GRANT EXECUTE ON FUNCTION test_ticket_handoff.issue(text,uuid,uuid,integer) TO ${issuer};
    GRANT EXECUTE ON FUNCTION test_ticket_handoff.consume(text,uuid,uuid) TO ${worker};
    INSERT INTO test_ticket_handoff.roles VALUES ('${operator}',true);
  `)
  const connect=(role,secret)=>{
   const url=new URL(LOCAL_DATABASE_URL);url.username=role;url.password=secret
   return sql=>run('psql',[url.toString(),'-X','-Atq','-v','ON_ERROR_STOP=1','-c',sql],{capture:true})
  }
  const issue=connect(issuer,secretIssuer),consume=connect(worker,secretWorker)
  const issueSql=(value,ttl=30)=>`SELECT test_ticket_handoff.issue('${value}','${operator}','${attempt}',${ttl})`
  const consumeSql=(value)=>`SELECT test_ticket_handoff.consume('${value}','${operator}','${attempt}')`
  await assert.rejects(consume(issueSql(token)),/permission denied/)
  await assert.rejects(issue(consumeSql(token)),/permission denied/)
  await assert.rejects(consume('SELECT * FROM test_ticket_handoff.tickets'),/permission denied/)
  await assert.rejects(issue('SELECT * FROM test_ticket_handoff.tickets'),/permission denied/)
  await assert.rejects(issue(issueSql('not-a-ticket')),/STORE_TEST_ISSUE_DENIED/)
  assert.match(await issue(issueSql(token)),/t/)
  assert.match(await issue(issueSql(expired,1)),/t/)
  assert.match(await issue(issueSql(revoked)),/t/)
  const stored=await psql(['-Atq'],`SELECT encode(ticket_hash,'hex') FROM test_ticket_handoff.tickets WHERE operator_id='${operator}'`,{capture:true})
  assert.equal(stored.includes(token),false)
  await assert.rejects(consume(`SELECT test_ticket_handoff.consume('${token}','${operator}','a1000000-0000-4000-8000-000000000003')`),/STORE_TEST_CONSUME_DENIED/)
  assert.match(await consume(`BEGIN;SELECT set_config('request.jwt.claim.sub','forged',true);${consumeSql(token)};COMMIT;`),/t/)
  await assert.rejects(consume(consumeSql(token)),/STORE_TEST_CONSUME_DENIED/)
  await psql([],`UPDATE test_ticket_handoff.tickets SET expires_at=clock_timestamp()-interval '1 second'
    WHERE ticket_hash=extensions.digest(decode('${expired}','hex'),'sha256')`)
  await assert.rejects(consume(consumeSql(expired)),/STORE_TEST_CONSUME_DENIED/)
  await psql([],`UPDATE test_ticket_handoff.roles SET allowed=false WHERE operator_id='${operator}'`)
  await assert.rejects(consume(consumeSql(revoked)),/STORE_TEST_CONSUME_DENIED/)
  await assert.rejects(issue(issueSql(randomBytes(32).toString('hex'))),/STORE_TEST_ISSUE_REVOKED/)
 })
}
