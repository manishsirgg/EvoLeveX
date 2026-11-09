import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectStoreDatabaseDeployment,REQUIRED_STORE_OBJECTS} from '../scripts/audit-store-database-deployment.mjs'

test('audit reports every missing live schema dependency without mutation',async()=>{
 const inspected=await inspectStoreDatabaseDeployment(async(sql,params)=>{
  assert.match(sql,/to_regprocedure/)
  assert.match(sql,/to_regclass/)
  assert.match(sql,/pg_catalog\.pg_trigger/)
  assert.doesNotMatch(sql,/INSERT INTO|UPDATE public|DELETE FROM|CREATE TABLE/i)
  assert.equal(params[0].length,REQUIRED_STORE_OBJECTS.length)
  return {rows:[]}
 })
 assert.equal(inspected.ready,false)
 assert.equal(inspected.results.length,REQUIRED_STORE_OBJECTS.length)
 assert.ok(inspected.results.every(x=>!x.installed))
})
test('audit accepts only exact existing object name/kind matches',async()=>{
 const found=REQUIRED_STORE_OBJECTS.map(x=>({kind:x.kind,name:x.name,installed:true}))
 const ready=await inspectStoreDatabaseDeployment(async()=>({rows:found}))
 assert.equal(ready.ready,true)
 const off=await inspectStoreDatabaseDeployment(async()=>({rows:found.map((x,i)=>i===0?{...x,name:x.name+'-wrong'}:x)}))
 assert.equal(off.ready,false)
 assert.equal(off.results[0].installed,false)
})
