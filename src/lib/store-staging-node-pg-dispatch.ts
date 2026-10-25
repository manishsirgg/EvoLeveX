import 'server-only'
import {Client} from 'pg'
import {createStoreStagingPgClientConfig,type StorePgSecrets} from './store-staging-pg-driver-config'
import {claimStagingStoreDispatchWithDedicatedPgClient} from './store-staging-pg-dispatch-session'
import type {TrustedStoreDispatchAttempt} from './store-provider-order-dispatch-core'

/**
 * A real Node pg implementation for an externally admitted isolated STAGING
 * worker. Call only after worker admission, trusted operator authentication,
 * and loading a prepared attempt. Secrets must come from the worker's own
 * secret manager; never expose this module in an HTTP route.
 *
 * This performs only the atomic claim; it NEVER makes a provider POST.
 */
export async function claimStagingStoreDispatchWithNodePg(
 attempt:TrustedStoreDispatchAttempt,
 expectedLoginRole:string,
 secrets:StorePgSecrets,
):Promise<boolean>{
 const settings=createStoreStagingPgClientConfig(secrets)
 const parsed=new URL(secrets.connectionString)
 if(parsed.username!==expectedLoginRole)
  throw new Error('STORE_PG_LOGIN_MISMATCH')
 return claimStagingStoreDispatchWithDedicatedPgClient(
  attempt,expectedLoginRole,()=>{const client=new Client(settings);return {
   connect:()=>client.connect(),
   query:async(sql,params)=>{const result=await client.query(sql,params?[...params]:[]);return {rows:result.rows as Record<string,unknown>[]}},
   end:()=>client.end(),
  }},
 )
}
