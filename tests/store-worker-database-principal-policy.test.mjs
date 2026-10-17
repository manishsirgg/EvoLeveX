import test from 'node:test'
import assert from 'node:assert/strict'
import {assertRestrictedWorkerDatabasePrincipal} from '../src/lib/store-worker-database-principal-policy.ts'
const good={loginRole:'evo_store_worker_staging',expectedRole:'evo_store_worker_staging',isSuperuser:false,canCreateRole:false,canBypassRls:false,canInherit:false,connectionUsesTls:true,secretSource:'dedicated-secret-manager'}
test('review contract allows only restricted worker principal',()=>assert.doesNotThrow(()=>assertRestrictedWorkerDatabasePrincipal(good)))
test('rejects privileged roles, identity mismatch and insecure credentials',()=>{
 for(const bad of [{...good,loginRole:'postgres'},{...good,loginRole:'authenticated'},{...good,expectedRole:'different'},{...good,isSuperuser:true},{...good,canCreateRole:true},{...good,canBypassRls:true},{...good,canInherit:true},{...good,connectionUsesTls:false},{...good,secretSource:'vercel-env'}]){
  assert.throws(()=>assertRestrictedWorkerDatabasePrincipal(bad),/STORE_WORKER_DB_/)
 }
})
