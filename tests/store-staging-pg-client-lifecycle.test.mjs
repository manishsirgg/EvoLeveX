import test from 'node:test'
import assert from 'node:assert/strict'
import {createStagingPgLifecycleFactory} from '../src/lib/store-staging-pg-client-lifecycle.ts'
import {createStagingRestrictedPgTransport} from '../src/lib/store-staging-pg-transport.ts'
import {STORE_RESTRICTED_ROLE_FUNCTION_SQL} from '../src/lib/store-staging-restricted-function-reader.ts'

const actor='a1000000-0000-4000-8000-000000000001'
const execute=(construct)=>createStagingRestrictedPgTransport(createStagingPgLifecycleFactory(construct))(
 STORE_RESTRICTED_ROLE_FUNCTION_SQL,[actor])
test('connects with TLS and bounded query settings, closes after successful query',async()=>{
 const events=[]
 const result=await execute(settings=>{
  assert.equal(settings.ssl.rejectUnauthorized,true)
  assert.equal(settings.connectionTimeoutMillis,3000)
  assert.equal(settings.query_timeout,3000)
  assert.equal(settings.statement_timeout,3000)
  return {
   connect:async()=>{events.push('connect')},
   query:async(sql,args)=>{
    events.push('query')
    assert.equal(sql,STORE_RESTRICTED_ROLE_FUNCTION_SQL)
    assert.deepEqual(args,[actor])
    return {rows:[{eligible:true}]}
   },
   end:async()=>{events.push('end')},
  }
 })
 assert.equal(result.rows[0].eligible,true)
 assert.deepEqual(events,['connect','query','end'])
})
test('query failure closes client, hides database error and secrets',async()=>{
 const events=[]
 await assert.rejects(execute(()=>({
  connect:async()=>{events.push('connect')},
  query:async()=>{events.push('query');throw Error('password=secret-example')},
  end:async()=>{events.push('end')},
 })),e=>e.message==='STORE_READER_CONNECTION_UNAVAILABLE')
 assert.deepEqual(events,['connect','query','end'])
})
test('failed connection still closes client and hides credentials',async()=>{
 let closes=0
 await assert.rejects(execute(()=>({
  connect:async()=>{throw Error('postgresql://private:password@secret.example')},
  query:async()=>{throw Error('should not query')},
  end:async()=>{closes++},
 })),e=>e.message==='STORE_READER_CONNECTION_UNAVAILABLE')
 assert.equal(closes,1)
})
test('failed close causes fail-closed result',async()=>{
 await assert.rejects(execute(()=>({
  connect:async()=>{},
  query:async()=>({rows:[{eligible:true}]}),
  end:async()=>{throw Error('secret close failure')},
 })),e=>e.message==='STORE_READER_CONNECTION_UNAVAILABLE')
})
