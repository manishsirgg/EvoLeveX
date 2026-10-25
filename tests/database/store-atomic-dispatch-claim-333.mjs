import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

export function registerStoreAtomicDispatchClaim333(serialTest,{psql,resetDatabase}){
 serialTest('PR 333: atomic dispatch claim succeeds once and denies second invocation',async()=>{
  await resetDatabase()
  const sql=await readFile(new URL('./fixtures/store-atomic-dispatch-claim-333.sql',import.meta.url),'utf8')
  await psql([],sql)
  const id='33300000-0000-4000-8000-000000000001'
  await psql([], `INSERT INTO test_store_dispatch_333.attempts(attempt_id,state)
    VALUES ('${id}'::uuid,'prepared');`)
  const first=await psql(['-Atq'],`SELECT test_store_dispatch_333.claim_once('${id}'::uuid);`,{capture:true})
  assert.equal(first.trim(),'t')
  const second=await psql(['-Atq'],`SELECT test_store_dispatch_333.claim_once('${id}'::uuid);`,{capture:true})
  assert.equal(second.trim(),'f')
  const persisted=await psql(['-Atq'],`SELECT state FROM test_store_dispatch_333.attempts WHERE attempt_id='${id}'::uuid;`,{capture:true})
  assert.equal(persisted.trim(),'dispatch_uncertain')
  const outsider=await psql(['-Atq'],`SELECT test_store_dispatch_333.claim_once('33300000-0000-4000-8000-000000000002'::uuid);`,{capture:true})
  assert.equal(outsider.trim(),'f')
  const grants=await psql(['-Atq'],`SELECT has_function_privilege('authenticated','test_store_dispatch_333.claim_once(uuid)','EXECUTE');`,{capture:true})
  assert.equal(grants.trim(),'f')
 })
}
