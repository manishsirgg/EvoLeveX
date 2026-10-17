import test from 'node:test'
import assert from 'node:assert/strict'
import {assertStoreDatabaseExecutorSafeToConnect} from '../src/lib/store-database-executor-boundary.ts'
test('privileged executor remains categorically disconnected',()=>{
 for(const enabled of [false,true]){
  const config={isolatedWorkerIdentityVerified:enabled,operatorProofVerifiedInDatabase:enabled,operatorRoleRecheckedInTransaction:enabled,atomicNonceEnforced:enabled,providerEvidenceVerified:enabled,restrictedDatabaseGrantReviewed:enabled}
  assert.throws(()=>assertStoreDatabaseExecutorSafeToConnect(config),/STORE_DATABASE_EXECUTOR_NOT_AUTHORIZED/)
 }
})
