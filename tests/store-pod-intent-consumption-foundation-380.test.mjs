import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261110210000_store_pod_intent_consumption_foundation.sql',import.meta.url),'utf8')

test('POD consumption ledger is private and binds nonce to correct quote identity',()=>{
 for(const marker of [
  'create table private.evo_store_pod_intent_consumptions',
  'unique(id,customer_id,idempotency_key)',
  'foreign key(quote_id,customer_id,idempotency_key)',
  'evo_store_pod_intent_nonce_once unique(worker_id,nonce)',
  'evo_store_pod_intent_quote_once unique(quote_id)',
  'evo_store_pod_intent_customer_key_once unique(customer_id,idempotency_key)',
  'alter table private.evo_store_pod_intent_consumptions enable row level security',
  'from public,anon,authenticated,service_role',
  "quote_digest text not null check (quote_digest ~ '^[a-f0-9]{64}$')",
  "proof_digest text not null check (proof_digest ~ '^[a-f0-9]{64}$')",
 ])assert.ok(sql.includes(marker),marker)
 assert.doesNotMatch(sql,/\bgrant\s+(all|insert|update|delete|execute)\b/i)
})

test('nonce consumption is time-stamped by DB and immutable even after quote expiry',()=>{
 for(const marker of [
  "proof_expires_at <= proof_issued_at + interval '60 seconds'",
  'consumed_at < proof_expires_at',
  'new.proof_issued_at > statement_timestamp()',
  'new.proof_expires_at <= statement_timestamp()',
  'new.consumed_at := statement_timestamp()',
  'before update or delete on private.evo_store_pod_intent_consumptions',
  'STORE_POD_INTENT_CONSUMPTION_IMMUTABLE',
  'STORE_POD_INTENT_CONSUMPTION_STALE',
 ])assert.ok(sql.includes(marker),marker)
 assert.equal((sql.match(/\bas \$\$/g)??[]).length,2)
 assert.equal((sql.match(/^\$\$;/gm)??[]).length,2)
 assert.doesNotMatch(sql,/\bas \$\n|^\$;/m)
 assert.doesNotMatch(sql,/drop table|truncate|delete from|on delete cascade|create policy/i)
})
