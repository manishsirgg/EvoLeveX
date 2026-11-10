import 'server-only'
import {reconcilePodQuoteReplay,type PodQuoteReplayDecision,
 type PodQuoteReplayRow,type PodQuoteReplayLine}
 from './pod-quote-idempotency-reconciliation'
import type {TrustedPodQuoteEvidence} from './pod-restricted-quote-contract'

type QueryResult={rows:readonly Record<string,unknown>[]}
export type PodReplaySession=Readonly<{
 query:(sql:string,params?:readonly unknown[])=>Promise<QueryResult>
}>
const ROLE='evo_store_pod_quote_writer'

/** Read-only inspection by an isolated, separately authenticated worker.
 * Not called by a browser, checkout route or the current writer. An ABSENT
 * result is advisory only: the unique constraint still owns atomic inserts.
 */
export async function inspectPodQuoteReplayWithRestrictedSession(
 incoming:TrustedPodQuoteEvidence,session:PodReplaySession,nowMs=Date.now(),
):Promise<PodQuoteReplayDecision>{
 try{
  const identity=await session.query('SELECT current_user AS principal, session_user AS login')
  if(identity.rows.length!==1||identity.rows[0].principal!==ROLE
   ||identity.rows[0].login!==ROLE)return {status:'UNAVAILABLE'}
  const header=await session.query(
   'SELECT id,customer_id,idempotency_key,printful_store_id,currency,'+
   'destination_country,destination_digest,subtotal::text,shipping_total::text,'+
   'tax_total::text,provider_shipping_option,provider_quote_observed_at,'+
   'expires_at,status FROM private.evo_store_pod_quote_snapshots '+
   'WHERE customer_id=$1::uuid AND idempotency_key=$2::uuid',
   [incoming.customerId,incoming.idempotencyKey],
  )
  if(header.rows.length>1)return {status:'UNAVAILABLE'}
  if(header.rows.length===0)
   return reconcilePodQuoteReplay(incoming,null,[],nowMs)
  const existing=header.rows[0] as unknown as PodQuoteReplayRow
  const lines=await session.query(
   'SELECT product_map_id,product_id,variant_id,sync_variant_id,'+
   'catalog_variant_id,quantity,sku,unit_price::text FROM '+
   'private.evo_store_pod_quote_lines WHERE quote_id=$1::uuid '+
   'ORDER BY variant_id',
   [existing.id],
  )
  return reconcilePodQuoteReplay(incoming,existing,
   lines.rows as unknown as PodQuoteReplayLine[],nowMs)
 }catch{
  return {status:'UNAVAILABLE'}
 }
}
