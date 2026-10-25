import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {auditStagingWorkerRole} from '../scripts/store-staging-role-audit.mjs'
const base={can_login:false,superuser:false,create_role:false,create_db:false,
 replication:false,bypass_rls:false,inherit:false,schema_usage:true,
 claim_execute:true,ledger_dml:false}
async function run(row,overrides={}){
 const folder=await mkdtemp(join(tmpdir(),'evx-role-audit-'))
 try{
  const ca=join(folder,'ca.pem');await writeFile(ca,'-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----')
  const events=[]
  class Client{
   constructor(settings){events.push('construct');assert.equal(settings.ssl.rejectUnauthorized,true)}
   async connect(){events.push('connect')}
   async query(sql,args){events.push('query');assert.match(sql,/pg_catalog.pg_roles/);assert.deepEqual(args,['evo_store_staging_claim_worker']);return {rows:[row]}}
   async end(){events.push('end')}
  }
  const env={STORE_WORKER_ENVIRONMENT:'staging',STORE_WORKER_ROLE_AUDIT_ENABLED:'true',
   STORE_WORKER_PAYMENT_CAPTURE_ENABLED:'false',STORE_WORKER_PRINTFUL_ENABLED:'false',
   STORE_RESERVATION_BRIDGE_ENABLED:'false',
   STORE_STAGING_ADMIN_DATABASE_URL:'postgresql://staging_dba:synthetic@staging.invalid:5432/store',
   STORE_WORKER_CA_FILE:ca,...overrides}
  return {result:await auditStagingWorkerRole(env,Client),events}
 }finally{await rm(folder,{recursive:true,force:true})}
}
test('read-only role audit detects pending login activation',async()=>{
 const {result,events}=await run(base)
 assert.equal(result.login_enabled,false)
 assert.equal(result.next_step,'review-secure-login-activation')
 assert.deepEqual(events,['construct','connect','query','end'])
})
test('read-only role audit recognizes restricted active login without executing dispatch',async()=>{
 const {result}=await run({...base,can_login:true})
 assert.equal(result.next_step,'run-worker-readiness')
 assert.equal(result.provider_calls,false)
})
test('read-only role audit refuses overprivileged role',async()=>{
 await assert.rejects(run({...base,bypass_rls:true}),/STORE_ROLE_AUDIT_PRIVILEGES_INVALID/)
 await assert.rejects(run({...base,ledger_dml:true}),/STORE_ROLE_AUDIT_PRIVILEGES_INVALID/)
})
test('read-only role audit denies nonstaging configuration before connecting',async()=>{
 await assert.rejects(run(base,{STORE_WORKER_ENVIRONMENT:'production'}),/STORE_ROLE_AUDIT_DENIED/)
})
test('role audit does not write to DB or send provider requests',async()=>{
 const code=await readFile(new URL('../scripts/store-staging-role-audit.mjs',import.meta.url),'utf8')
 assert.doesNotMatch(code,/client\.query\(\s*['`](?:UPDATE|DELETE|INSERT|ALTER|GRANT|REVOKE)|createRazorpayOrder\(|fetch\(/i)
})
