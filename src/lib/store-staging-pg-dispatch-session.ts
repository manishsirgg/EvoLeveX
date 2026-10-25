import 'server-only'
import {claimStoreDispatchWithRestrictedSession} from './store-restricted-dispatch-claim-adapter'
import type {TrustedStoreDispatchAttempt} from './store-provider-order-dispatch-core'

type PgResult=Readonly<{rows:ReadonlyArray<Record<string,unknown>>}>
export type StagingClaimPgClient=Readonly<{
 connect:()=>Promise<void>
 query:(sql:string,params?:readonly unknown[])=>Promise<PgResult>
 end:()=>Promise<void>
}>
/**
 * This is a staging-only execution boundary. The isolated worker constructs
 * the PG client using dedicated TLS-verified credentials; never use a normal
 * Next.js request handler, pool shared with another role, or browser token.
 * Identity and claim share one connected session. Every path closes it.
 */
export async function claimStagingStoreDispatchWithDedicatedPgClient(
 attempt:TrustedStoreDispatchAttempt,
 expectedLoginRole:string,
 createClient:()=>StagingClaimPgClient,
):Promise<boolean>{
 const client=createClient()
 let connected=false
 let operationError:unknown
 let result=false
 try{
  await client.connect()
  connected=true
  result=await claimStoreDispatchWithRestrictedSession(attempt,client,expectedLoginRole)
 }catch(error){
  operationError=error
 }
 try{
  // Even failed connects should have their socket resources released.
  await client.end()
 }catch{
  throw new Error('STORE_DISPATCH_PG_CLOSE_FAILED')
 }
 if(operationError)throw operationError
 if(!connected)throw new Error('STORE_DISPATCH_PG_CONNECT_FAILED')
 return result
}
