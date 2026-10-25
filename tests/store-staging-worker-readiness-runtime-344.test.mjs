import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {probeStoreStagingWorker} from '../scripts/store-staging-worker-readiness.mjs'

const role='evo_store_staging_claim_worker'
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'evx-staging-readiness-'))
 try{
  const cert=join(dir,'root.pem')
  await writeFile(cert,'-----BEGIN CERTIFICATE-----\nsynthetic-test-cert\n-----END CERTIFICATE-----\n')
  const env={
   STORE_WORKER_ENVIRONMENT:'staging',STORE_WORKER_RUNTIME:'isolated-worker',
   STORE_WORKER_READINESS_ENABLED:'true',STORE_WORKER_PAYMENT_CAPTURE_ENABLED:'false',
   STORE_WORKER_PRINTFUL_ENABLED:'false',STORE_RESERVATION_BRIDGE_ENABLED:'false',
   STORE_WORKER_DB_ROLE:role,
   STORE_WORKER_DATABASE_URL:`postgresql://${role}:synthetic-password@staging.invalid:5432/store`,
   STORE_WORKER_CA_FILE:cert,
  }
  await fn(env)
 }finally{await rm(dir,{recursive:true,force:true})}
}
const restricted=(overrides={})=>({
 principal:role,login:role,can_claim:true,
 is_superuser:false,can_create_role:false,can_bypass_rls:false,
 can_inherit:false,can_create_db:false,can_replicate:false,can_mutate_ledger:false,
 ...overrides,
})
function mockPg(rows,options={}){
 const calls=[]
 class Client{
  constructor(settings){calls.push('construct');assert.equal(settings.ssl.rejectUnauthorized,true)}
  async connect(){calls.push('connect');if(options.connectFails)throw Error('simulated-connection-failure')}
  async query(sql){calls.push('query');assert.match(sql,/current_user AS principal/);assert.match(sql,/has_function_privilege/);return {rows}}
  async end(){calls.push('end');if(options.closeFails)throw Error('simulated-close-failure')}
 }
 return {Client,calls}
}
test('runtime readiness reports success only for exact verified restricted role and closes client',async()=>{
 await fixture(async env=>{
  const {Client,calls}=mockPg([restricted()])
  const result=await probeStoreStagingWorker(env,Client)
  assert.deepEqual(result,{ready:true,environment:'staging',principal:role,provider_calls:false})
  assert.deepEqual(calls,['construct','connect','query','end'])
 })
})
test('runtime readiness denies missing EXECUTE and closes session',async()=>{
 await fixture(async env=>{
  const {Client,calls}=mockPg([restricted({can_claim:false})])
  await assert.rejects(probeStoreStagingWorker(env,Client),/STORE_READINESS_DB_ROLE_OR_GRANT_DENIED/)
  assert.deepEqual(calls,['construct','connect','query','end'])
 })
})
test('runtime readiness rejects substituted principal and closes session',async()=>{
 await fixture(async env=>{
  const {Client,calls}=mockPg([restricted({principal:'postgres'})])
  await assert.rejects(probeStoreStagingWorker(env,Client),/STORE_READINESS_DB_ROLE_OR_GRANT_DENIED/)
  assert.deepEqual(calls,['construct','connect','query','end'])
 })
})
test('runtime readiness denies closed payment gates before connecting',async()=>{
 await fixture(async env=>{
  env.STORE_WORKER_PAYMENT_CAPTURE_ENABLED='true'
  const {Client,calls}=mockPg([restricted()])
  await assert.rejects(probeStoreStagingWorker(env,Client),/STORE_READINESS_ADMISSION_DENIED/)
  assert.deepEqual(calls,[])
 })
})
test('runtime readiness closes failed connections',async()=>{
 await fixture(async env=>{
  const {Client,calls}=mockPg([],{connectFails:true})
  await assert.rejects(probeStoreStagingWorker(env,Client),/simulated-connection-failure/)
  assert.deepEqual(calls,['construct','connect','end'])
 })
})

test('runtime readiness rejects overprivileged worker roles before reporting success',async()=>{
 await fixture(async env=>{
  for(const field of ['is_superuser','can_create_role','can_bypass_rls','can_inherit','can_create_db','can_replicate','can_mutate_ledger']){
   const {Client,calls}=mockPg([restricted({[field]:true})])
   await assert.rejects(probeStoreStagingWorker(env,Client),/STORE_READINESS_DB_ROLE_OR_GRANT_DENIED/)
   assert.deepEqual(calls,['construct','connect','query','end'],field)
  }
 })
})
