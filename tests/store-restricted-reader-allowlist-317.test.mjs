import test from 'node:test'
import assert from 'node:assert/strict'
import {createStagingRestrictedPgTransport} from '../src/lib/store-staging-pg-transport.ts'
import {STORE_RESTRICTED_ROLE_FUNCTION_SQL} from '../src/lib/store-staging-restricted-function-reader.ts'

test('reader transport refuses arbitrary SQL without opening a connection',async()=>{
 let opened=0
 const query=createStagingRestrictedPgTransport(async()=>{opened++;return {query:async()=>({rows:[{eligible:true}]})}})
 const forbidden=[
  'SELECT * FROM public.payments',
  'SELECT * FROM public.user_roles',
  'SELECT private.evo_store_operator_eligible_for_reconciliation($1::uuid)',
  STORE_RESTRICTED_ROLE_FUNCTION_SQL+'; SELECT current_user',
  STORE_RESTRICTED_ROLE_FUNCTION_SQL+' -- appended',
  ' '+STORE_RESTRICTED_ROLE_FUNCTION_SQL,
 ]
 for(const sql of forbidden){
  await assert.rejects(query(sql,['a1000000-0000-4000-8000-000000000002']),/QUERY_DENIED/)
 }
 for(const params of [[],['id1','id2'],null]){
  await assert.rejects(query(STORE_RESTRICTED_ROLE_FUNCTION_SQL,params),/QUERY_DENIED/)
 }
 assert.equal(opened,0)
 assert.deepEqual((await query(STORE_RESTRICTED_ROLE_FUNCTION_SQL,['a1000000-0000-4000-8000-000000000002'])).rows,[{eligible:true}])
 assert.equal(opened,1)
})
