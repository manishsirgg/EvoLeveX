import 'server-only'
import {validateTrustedPodQuoteEvidence,type TrustedPodQuoteEvidence}
 from './pod-restricted-quote-contract'

type QueryResult=Readonly<{rows:readonly Record<string,unknown>[]}>
export type PodQuoteRestrictedSession=Readonly<{
 query:(sql:string,params?:readonly unknown[])=>Promise<QueryResult>
}>
const ROLE='evo_store_pod_quote_writer'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Isolated quote persistence adapter, not reachable from any customer route.
 * No connection management, grants, role provisioning or payment capability.
 * A future isolated worker must independently verify customer address,
 * supplier quote, production, tax, price, mapping and idempotency.
 *
 * This capability is intentionally NOT executable with currently provisioned
 * application roles. The private tables have RLS with no INSERT grants/policy.
 */
export async function persistPreparedPodQuoteWithRestrictedSession(
 evidence:TrustedPodQuoteEvidence,
 session:PodQuoteRestrictedSession,
 nowMs=Date.now(),
):Promise<string>{
 const validation=validateTrustedPodQuoteEvidence(evidence,nowMs)
 if(!validation.ok)throw new Error('STORE_POD_QUOTE_EVIDENCE_INVALID')
 let transactionStarted=false
 try{
  await session.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
  transactionStarted=true
  // Only the separately provisioned login may write these private tables.
  // SET ROLE on an app/service-role connection must never count as authority.
  const identity=await session.query('SELECT current_user AS principal, session_user AS login')
  if(identity.rows.length!==1||identity.rows[0].principal!==ROLE
    ||identity.rows[0].login!==ROLE)
   throw new Error('STORE_POD_QUOTE_PRINCIPAL_DENIED')
  const result=await session.query(
   'INSERT INTO private.evo_store_pod_quote_snapshots '+
   '(customer_id,idempotency_key,printful_store_id,currency,'+
   'destination_country,destination_digest,subtotal,shipping_total,tax_total,'+
   'provider_shipping_option,provider_quote_observed_at,expires_at) '+
   'VALUES ($1::uuid,$2::uuid,$3::uuid,$4::char(3),'+
   '$5::char(2),$6::text,$7::numeric,$8::numeric,$9::numeric,'+
   '$10::text,$11::timestamptz,$12::timestamptz) RETURNING id',
   [evidence.customerId,evidence.idempotencyKey,evidence.printfulStoreId,
    evidence.currency,evidence.destinationCountry,evidence.destinationDigest,
    evidence.subtotal,evidence.shippingTotal,evidence.taxTotal,
    evidence.providerShippingOption,evidence.providerQuoteObservedAt,evidence.expiresAt],
  )
  const quoteId=result.rows.length===1?result.rows[0].id:null
  if(typeof quoteId!=='string'||!UUID.test(quoteId))
   throw new Error('STORE_POD_QUOTE_INSERT_FAILED')
  for(let i=0;i<evidence.lines.length;i++){
   const line=evidence.lines[i]
   await session.query(
    'INSERT INTO private.evo_store_pod_quote_lines '+
    '(quote_id,printful_store_id,line_number,product_map_id,product_id,'+
    'variant_id,sync_variant_id,catalog_variant_id,quantity,sku,unit_price) '+
    'VALUES ($1::uuid,$2::uuid,$3::integer,$4::uuid,$5::uuid,'+
    '$6::uuid,$7::text,$8::text,$9::integer,$10::text,$11::numeric)',
    [quoteId,evidence.printfulStoreId,i+1,line.productMapId,line.productId,
     line.variantId,line.syncVariantId,line.catalogVariantId,line.quantity,
     line.sku,line.unitPrice],
   )
  }
  // Force deferred quote-total and provider-mapping constraints before success.
  await session.query('SET CONSTRAINTS ALL IMMEDIATE')
  await session.query('COMMIT')
  transactionStarted=false
  return quoteId
 }catch{
  if(transactionStarted){
   try{await session.query('ROLLBACK')}catch{
    // Reconciliation of an ambiguous rollback belongs to the future worker.
   }
  }
  throw new Error('STORE_POD_QUOTE_PERSISTENCE_DENIED')
 }
}
