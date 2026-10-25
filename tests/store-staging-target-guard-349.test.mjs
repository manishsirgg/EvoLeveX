import test from 'node:test'
import assert from 'node:assert/strict'
import {assertIndependentStoreStagingTarget} from '../src/lib/store-staging-target-guard.ts'
const prod='aaaaaaaaaaaaaaaaaaaa',staging='bbbbbbbbbbbbbbbbbbbb'
test('different verified Supabase staging project passes',()=>{
 assert.doesNotThrow(()=>assertIndependentStoreStagingTarget({
  stagingProjectRef:staging,productionProjectRef:prod,databaseHostname:`db.${staging}.supabase.co`}))
})
test('production re-use and wrong DB hostname fail closed',()=>{
 for(const values of [
  {stagingProjectRef:prod,productionProjectRef:prod,databaseHostname:`db.${prod}.supabase.co`},
  {stagingProjectRef:staging,productionProjectRef:prod,databaseHostname:`db.${prod}.supabase.co`},
  {stagingProjectRef:'',productionProjectRef:prod,databaseHostname:`db.${staging}.supabase.co`},
 ])assert.throws(()=>assertIndependentStoreStagingTarget(values),/STORE_STAGING_TARGET_NOT_INDEPENDENT/)
})
