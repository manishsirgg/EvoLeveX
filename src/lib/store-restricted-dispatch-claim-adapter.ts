import 'server-only'
import type {TrustedStoreDispatchAttempt} from './store-provider-order-dispatch-core'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type QueryResult=Readonly<{rows:ReadonlyArray<Record<string,unknown>>}>
export type RestrictedClaimSession=Readonly<{
 query:(sql:string,params?:readonly unknown[])=>Promise<QueryResult>
}>

/**
 * SQL capability for a separately provisioned restricted PostgreSQL worker.
 * Never constructs a connection, acquires credentials or grants execution.
 * Caller must supply a connected/verified TLS session using the exact dedicated
 * role. The role must receive only reviewed function EXECUTE permission.
 */
export async function claimStoreDispatchWithRestrictedSession(
 attempt:TrustedStoreDispatchAttempt,
 session:RestrictedClaimSession,
 expectedLoginRole:string,
):Promise<boolean>{
 if(!UUID.test(attempt.attemptId)||attempt.state!=='prepared'
  ||!/^evo_store_[a-z0-9_]{3,48}$/.test(expectedLoginRole))
  throw new Error('STORE_DISPATCH_CLAIM_INPUT_INVALID')
 const identity=await session.query('SELECT current_user AS principal, session_user AS login')
 if(identity.rows.length!==1
  ||identity.rows[0].principal!==expectedLoginRole
  ||identity.rows[0].login!==expectedLoginRole)
  throw new Error('STORE_DISPATCH_CLAIM_PRINCIPAL_DENIED')
 // The target function is denied to PUBLIC, anon, authenticated and service_role.
 // This is the ONLY mutation allowed by this adapter, parameter-bound.
 const result=await session.query(
  'SELECT private.claim_evo_store_provider_dispatch($1::uuid) AS claimed',
  [attempt.attemptId],
 )
 if(result.rows.length!==1||typeof result.rows[0].claimed!=='boolean')
  throw new Error('STORE_DISPATCH_CLAIM_RESULT_INVALID')
 return result.rows[0].claimed
}
