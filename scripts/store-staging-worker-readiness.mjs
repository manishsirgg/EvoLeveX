#!/usr/bin/env node
/**
 * Isolated staging worker READ-ONLY readiness probe.
 * No dispatch claim, Razorpay POST, capture, or Printful operation.
 * Run manually only on a separately provisioned staging system.
 */
import {Client} from 'pg'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'

const ROLE=/^evo_store_[a-z0-9_]{3,48}$/
const SQL=`SELECT current_user AS principal, session_user AS login,
 has_function_privilege(current_user,
   'private.claim_evo_store_provider_dispatch(uuid)', 'EXECUTE') AS can_claim,
 r.rolsuper AS is_superuser, r.rolcreaterole AS can_create_role,
 r.rolbypassrls AS can_bypass_rls, r.rolinherit AS can_inherit,
 r.rolcreatedb AS can_create_db, r.rolreplication AS can_replicate,
 has_table_privilege(current_user,
   'private.evo_store_provider_order_attempts', 'INSERT,UPDATE,DELETE') AS can_mutate_ledger
 FROM pg_catalog.pg_roles AS r WHERE r.rolname = current_user

export async function probeStoreStagingWorker(env=process.env,ClientType=Client){
 if(env.STORE_WORKER_ENVIRONMENT!=='staging'
  ||env.STORE_WORKER_RUNTIME!=='isolated-worker'
  ||env.STORE_WORKER_READINESS_ENABLED!=='true'
  ||env.STORE_WORKER_PAYMENT_CAPTURE_ENABLED!=='false'
  ||env.STORE_WORKER_PRINTFUL_ENABLED!=='false'
  ||env.STORE_RESERVATION_BRIDGE_ENABLED!=='false')
  throw new Error('STORE_READINESS_ADMISSION_DENIED')
 const role=env.STORE_WORKER_DB_ROLE
 if(!ROLE.test(role??''))throw new Error('STORE_READINESS_ROLE_INVALID')
 const connectionString=env.STORE_WORKER_DATABASE_URL
 const certFile=env.STORE_WORKER_CA_FILE
 if(!connectionString||!certFile)throw new Error('STORE_READINESS_SECRETS_MISSING')
 let url
 try{url=new URL(connectionString)}catch{throw new Error('STORE_READINESS_DB_URL_INVALID')}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.username!==role
  ||!url.password||!url.hostname||url.search)
  throw new Error('STORE_READINESS_DB_URL_INVALID')
 const ca=await readFile(certFile,'utf8')
 if(!ca.includes('-----BEGIN CERTIFICATE-----')||!ca.includes('-----END CERTIFICATE-----'))
  throw new Error('STORE_READINESS_CA_INVALID')
 const client=new ClientType({
  connectionString,ssl:{rejectUnauthorized:true,ca},
  connectionTimeoutMillis:3000,query_timeout:3000,statement_timeout:3000,
  application_name:'evo-store-staging-readiness',
 })
 try{
  await client.connect()
  const result=await client.query(SQL)
  if(result.rows.length!==1||result.rows[0].principal!==role
   ||result.rows[0].login!==role||result.rows[0].can_claim!==true
   ||result.rows[0].is_superuser!==false||result.rows[0].can_create_role!==false
   ||result.rows[0].can_bypass_rls!==false||result.rows[0].can_inherit!==false
   ||result.rows[0].can_create_db!==false||result.rows[0].can_replicate!==false
   ||result.rows[0].can_mutate_ledger!==false)
   throw new Error('STORE_READINESS_DB_ROLE_OR_GRANT_DENIED')
  return {ready:true,environment:'staging',principal:role,provider_calls:false}
 }finally{
  await client.end()
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 probeStoreStagingWorker().then(value=>{process.stdout.write(JSON.stringify(value)+'\n')}).catch(()=>{
  process.stderr.write('Store staging readiness denied; inspect isolated worker configuration.\n')
  process.exitCode=1
 })
}
