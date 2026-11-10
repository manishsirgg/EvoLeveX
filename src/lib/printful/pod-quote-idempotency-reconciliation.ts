import {createHash,timingSafeEqual} from 'node:crypto'
import {validateTrustedPodQuoteEvidence,type TrustedPodQuoteEvidence}
 from './pod-restricted-quote-contract'

/** A fingerprint is a replay comparator, NOT proof of tax, supplier or payment
 * authenticity. The complete quote evidence must be trusted independently.
 */
export type PodQuoteReplayRow=Readonly<{
 id:string;customer_id:string;idempotency_key:string;printful_store_id:string;
 currency:string;destination_country:string;destination_digest:string;
 subtotal:string;shipping_total:string;tax_total:string;
 provider_shipping_option:string;provider_quote_observed_at:string;
 expires_at:string;status:string;
}>
export type PodQuoteReplayLine=Readonly<{
 product_map_id:string;product_id:string;variant_id:string;
 sync_variant_id:string;catalog_variant_id:string;
 quantity:number;sku:string;unit_price:string;
}>
export type PodQuoteReplayDecision=
 | {status:'ABSENT'}
 | {status:'MATCH';quoteId:string}
 | {status:'CONFLICT'|'UNAVAILABLE'}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH=/^[a-f0-9]{64}$/

function normalizeAmount(value:string):string|null{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,11})\.[0-9]{2}$/.test(value))return null
 return value
}
function normalizeTimestamp(value:string):string|null{
 if(typeof value!=='string')return null
 const time=Date.parse(value)
 if(!Number.isFinite(time))return null
 return new Date(time).toISOString()
}
type FingerprintLine={productMapId:string;productId:string;variantId:string;
 syncVariantId:string;catalogVariantId:string;quantity:number;sku:string;unitPrice:string}
type FingerprintInput={customerId:string;idempotencyKey:string;printfulStoreId:string;
 currency:string;destinationCountry:string;destinationDigest:string;
 subtotal:string;shippingTotal:string;taxTotal:string;
 providerShippingOption:string;providerQuoteObservedAt:string;expiresAt:string;
 lines:readonly FingerprintLine[]}

function fingerprint(input:FingerprintInput):string|null{
 const observed=normalizeTimestamp(input.providerQuoteObservedAt)
 const expires=normalizeTimestamp(input.expiresAt)
 if(!observed||!expires||!UUID.test(input.customerId)||!UUID.test(input.idempotencyKey)
  ||!UUID.test(input.printfulStoreId)||typeof input.destinationDigest!=='string'
  ||!HASH.test(input.destinationDigest)||!input.lines?.length)return null
 const subtotal=normalizeAmount(input.subtotal)
 const shipping=normalizeAmount(input.shippingTotal)
 const tax=normalizeAmount(input.taxTotal)
 if(subtotal===null||shipping===null||tax===null)return null
 const lines=input.lines.map(v=>({
  productMapId:v.productMapId.toLowerCase(),productId:v.productId.toLowerCase(),
  variantId:v.variantId.toLowerCase(),syncVariantId:v.syncVariantId,
  catalogVariantId:v.catalogVariantId,quantity:v.quantity,sku:v.sku,
  unitPrice:normalizeAmount(v.unitPrice),
 })).sort((a,b)=>a.variantId.localeCompare(b.variantId))
 if(lines.some(l=>!UUID.test(l.productMapId)||!UUID.test(l.productId)
  ||!UUID.test(l.variantId)||l.unitPrice===null
  ||!Number.isSafeInteger(l.quantity)||l.quantity<1||l.quantity>10))return null
 return createHash('sha256').update(JSON.stringify({
  version:1,customerId:input.customerId.toLowerCase(),
  idempotencyKey:input.idempotencyKey.toLowerCase(),
  printfulStoreId:input.printfulStoreId.toLowerCase(),
  currency:input.currency.trim(),destinationCountry:input.destinationCountry,
  destinationDigest:input.destinationDigest,subtotal,shippingTotal:shipping,taxTotal:tax,
  providerShippingOption:input.providerShippingOption,
  providerQuoteObservedAt:observed,expiresAt:expires,lines,
 })).digest('hex')
}

export function reconcilePodQuoteReplay(
 incoming:TrustedPodQuoteEvidence,
 existing:PodQuoteReplayRow|null,
 existingLines:readonly PodQuoteReplayLine[],
 nowMs=Date.now(),
):PodQuoteReplayDecision{
 if(!Number.isSafeInteger(nowMs))return {status:'UNAVAILABLE'}
 const valid=validateTrustedPodQuoteEvidence(incoming,nowMs)
 if(!valid.ok)return {status:'UNAVAILABLE'}
 if(!existing)return existingLines.length===0?{status:'ABSENT'}:{status:'UNAVAILABLE'}
 if(!UUID.test(existing.id)||existing.customer_id.toLowerCase()!==incoming.customerId.toLowerCase()
  ||existing.idempotency_key.toLowerCase()!==incoming.idempotencyKey.toLowerCase())
  return {status:'CONFLICT'}
 if(existing.status!=='prepared'||Date.parse(existing.expires_at)<=nowMs)
  return {status:'UNAVAILABLE'}
 if(existingLines.length!==incoming.lines.length)return {status:'CONFLICT'}
 const left=fingerprint(incoming)
 const right=fingerprint({
  customerId:existing.customer_id,idempotencyKey:existing.idempotency_key,
  printfulStoreId:existing.printful_store_id,currency:existing.currency,
  destinationCountry:existing.destination_country,
  destinationDigest:existing.destination_digest,subtotal:existing.subtotal,
  shippingTotal:existing.shipping_total,taxTotal:existing.tax_total,
  providerShippingOption:existing.provider_shipping_option,
  providerQuoteObservedAt:existing.provider_quote_observed_at,
  expiresAt:existing.expires_at,lines:existingLines.map(v=>({
   productMapId:v.product_map_id,productId:v.product_id,variantId:v.variant_id,
   syncVariantId:v.sync_variant_id,catalogVariantId:v.catalog_variant_id,
   quantity:v.quantity,sku:v.sku,unitPrice:v.unit_price,
  })),
 })
 if(!left||!right)return {status:'UNAVAILABLE'}
 const matches=timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'))
 return matches?{status:'MATCH',quoteId:existing.id}:{status:'CONFLICT'}
}
