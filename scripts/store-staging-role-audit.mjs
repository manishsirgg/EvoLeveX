#!/usr/bin/env node
/**
 * Read-only staging DBA preflight, prior to provisioning/activating a worker.
 * Must be run against a separately configured staging database by its DBA.
 * No CREATE ROLE, ALTER ROLE, grants, payment requests or customer data access.
 */
import {Client} from 'pg'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'

const TARGET='evo_store_staging_claim_worker'
const SQL=`SELECT r.rolcanlogin AS can_login, r.rolsuper AS superuser,
 r.rolcreaterole AS create_role,r.rolcreatedb AS create_db,
 r.rolreplication AS replication,r.rolbypassrls AS bypass_rls,
 r.rolinherit AS inherit,
 has_schema_privilege(r.oid,'private','USAGE') AS schema_usage,
 has_function_privilege(r.oid,'private.claim_evo_store_provider_dispatch(uuid)','EXECUTE') AS claim_execute,
 has_table_privilege(r.oid,'private.evo_store_provider_order_attempts','INSERT,UPDATE,DELETE') AS ledger_dml
 FROM pg_catalog.pg_roles r WHERE r.rolname=$1`

export async function auditStagingWorkerRole(env=process.env,Driver=Client){
 if(env.STORE_WORKER_ENVIRONMENT!=='staging'
  ||env.STORE_WORKER_ROLE_AUDIT_ENABLED!=='true'
  ||env.STORE_WORKER_PAYMENT_CAPTURE_ENABLED!=='false'
  ||env.STORE_WORKER_PRINTFUL_ENABLED!=='false'
  ||env.STORE_RESERVATION_BRIDGE_ENABLED!=='false')
  throw new Error('STORE_ROLE_AUDIT_DENIED')
 const connectionString=env.STORE_STAGING_ADMIN_DATABASE_URL
 const certPath=env.STORE_WORKER_CA_FILE
 if(!connectionString||!certPath)throw new Error('STORE_ROLE_AUDIT_CONFIG_MISSING')
 let url
 try{url=new URL(connectionString)}catch{throw new Error('STORE_ROLE_AUDIT_URL_DENIED')}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.password
  ||!url.username||url.search||url.username===TARGET)
  throw new Error('STORE_ROLE_AUDIT_URL_DENIED')
 const ca=await readFile(certPath,'utf8')
 if(!ca.includes('-----BEGIN CERTIFICATE-----')||!ca.includes('-----END CERTIFICATE-----'))
  throw new Error('STORE_ROLE_AUDIT_CA_INVALID')
 const client=new Driver({connectionString,ssl:{ca,rejectUnauthorized:true},
  connectionTimeoutMillis:3000,statement_timeout:3000,query_timeout:3000,
  application_name:'evo-store-staging-role-audit'})
 try{
  await client.connect()
  const response=await client.query(SQL,[TARGET])
  if(response.rows.length!==1)throw new Error('STORE_ROLE_AUDIT_ROLE_MISSING')
  const row=response.rows[0]
  if(row.superuser!==false||row.create_role!==false||row.create_db!==false
   ||row.replication!==false||row.bypass_rls!==false||row.inherit!==false
   ||row.schema_usage!==true||row.claim_execute!==true||row.ledger_dml!==false
   ||typeof row.can_login!=='boolean')throw new Error('STORE_ROLE_AUDIT_PRIVILEGES_INVALID')
  return {role:TARGET,privileges_valid:true,login_enabled:row.can_login,
   next_step:row.can_login?'run-worker-readiness':'review-secure-login-activation',
   provider_calls:false}
 }finally{await client.end()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 auditStagingWorkerRole().then(r=>process.stdout.write(JSON.stringify(r)+'\n')).catch(()=>{
  process.stderr.write('Staging role audit failed. Verify staging database and permissions.\n')
  process.exitCode=1
 })
}
