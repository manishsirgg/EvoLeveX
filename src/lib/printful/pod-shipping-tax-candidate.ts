import 'server-only'
import {createHash,timingSafeEqual} from 'node:crypto'
import {isSupportedCurrency} from '@/lib/currency'
import type {ResolvedPodInputs} from './pod-authoritative-input-resolver'
import type {PodFullCartShippingResult} from './pod-full-cart-shipping'

/**
 * Pure candidate calculation from independently established inputs.
 * This is NOT the restricted quote writer's TrustedPodQuoteEvidence:
 * it lacks full customer-address binding, approval, replay and production
 * authorization. Do not forward directly to persistence or payment.
 */
export type ApprovedPodTaxEvidence=Readonly<{
 source:'MERCHANT_APPROVED_TAX_ENGINE'
 currency:string
 amount:string
 observedAt:string
 destinationCountry:'IN'|'US'
 linesDigest:string
}>
export type PodQuoteCandidate=Readonly<{
 currency:string
 subtotal:string
 shippingTotal:string
 taxTotal:string
 grandTotal:string
 providerShippingOption:string
 providerQuoteObservedAt:string
 lineCount:number
 paymentReady:false
 fulfillmentReady:false
}>
export type PodCandidateResult=
 | {ok:true;candidate:PodQuoteCandidate}
 | {ok:false;code:'CURRENCY_INVALID'|'LINES_INVALID'|'SHIPPING_UNAVAILABLE'|
 'SHIPPING_OPTION_INVALID'|'TAX_NOT_APPROVED'|'EVIDENCE_STALE'|'TOTAL_INVALID'}

const DECIMAL=/^(0|[1-9][0-9]{0,11})\.[0-9]{2}$/
const DIGEST=/^[a-f0-9]{64}$/
const OPTION_ID=/^[a-zA-Z0-9_-]{1,60}$/
const MAX_CENTS=BigInt('99999999999999')

/** Canonical cart+destination digest for binding an externally approved tax
 * calculation. This digest is NOT a signature or proof of tax authority. */
export function digestPodTaxBasis(inputs:ResolvedPodInputs):string{
 const lines=[...inputs.lines].map(l=>({
  variantId:l.variantId.toLowerCase(),quantity:l.quantity,unitPrice:l.unitPrice,
 })).sort((a,b)=>a.variantId.localeCompare(b.variantId))
 const d=inputs.destination
 return createHash('sha256').update(JSON.stringify({
  version:1,currency:inputs.currency,
  country:d.countryCode,state:d.stateCode??'',postal:d.postalCode,
  city:d.city,lines,
 })).digest('hex')
}
function toCents(s:string):bigint|null{
 if(typeof s!=='string'||!DECIMAL.test(s))return null
 const [major,minor]=s.split('.')
 return BigInt(major)*BigInt(100)+BigInt(minor)
}
function asMoney(cents:bigint):string{
 return (cents/BigInt(100)).toString()+'.'+(cents%BigInt(100)).toString().padStart(2,'0')
}

/** Explicit selected-option and signed-off tax inputs must be independently
 * obtained; TS object shapes provide no authenticity, so this module never
 * grants a persistable/chargeable quote or attests evidence provenance. */
export function evaluatePodQuoteCandidate(
 resolved:ResolvedPodInputs,
 shipping:PodFullCartShippingResult,
 selectedOptionId:string,
 shippingObservedAt:string,
 tax:ApprovedPodTaxEvidence,
 nowMs=Date.now(),
):PodCandidateResult{
 if(!resolved||!isSupportedCurrency(resolved.currency)
   ||resolved.currency==='JPY')
  return {ok:false,code:'CURRENCY_INVALID'}
 if(!Array.isArray(resolved.lines)||resolved.lines.length===0
   ||resolved.lines.length>50)
  return {ok:false,code:'LINES_INVALID'}
 let subtotal=BigInt(0),quantity=0
 const seen=new Set<string>()
 for(const line of resolved.lines){
  if(!line||typeof line.variantId!=='string'||seen.has(line.variantId.toLowerCase())
   ||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10)
   return {ok:false,code:'LINES_INVALID'}
  seen.add(line.variantId.toLowerCase())
  const price=toCents(line.unitPrice)
  if(price===null||price<=BigInt(0))
   return {ok:false,code:'LINES_INVALID'}
  subtotal+=price*BigInt(line.quantity)
  quantity+=line.quantity
 }
 if(quantity>50||subtotal>MAX_CENTS)return {ok:false,code:'TOTAL_INVALID'}
 if(!shipping?.ok||shipping.lineCount!==resolved.lines.length
   ||!Array.isArray(shipping.options)||shipping.options.length===0
   ||shipping.options.length>20)
  return {ok:false,code:'SHIPPING_UNAVAILABLE'}
 if(typeof selectedOptionId!=='string'||!OPTION_ID.test(selectedOptionId)
   ||shipping.options.filter(o=>o.id===selectedOptionId).length!==1)
  return {ok:false,code:'SHIPPING_OPTION_INVALID'}
 const selected=shipping.options.find(o=>o.id===selectedOptionId)!
 if(selected.currency!==resolved.currency)
  return {ok:false,code:'CURRENCY_INVALID'}
 const shippingCents=toCents(selected.rate)
 if(shippingCents===null)
  return {ok:false,code:'SHIPPING_OPTION_INVALID'}
 const observed=Date.parse(shippingObservedAt)
 if(!Number.isSafeInteger(nowMs)||!Number.isFinite(observed)
   ||observed>nowMs||nowMs-observed>120000)
  return {ok:false,code:'EVIDENCE_STALE'}
 // Tax must have a separate merchant-approved calculation for this exact
 // destination/cart; a mere placeholder "0.00" without approval is rejected.
 if(!tax||tax.source!=='MERCHANT_APPROVED_TAX_ENGINE'
   ||tax.destinationCountry!==resolved.destination.countryCode
   ||tax.currency!==resolved.currency
   ||typeof tax.linesDigest!=='string'||!DIGEST.test(tax.linesDigest))
  return {ok:false,code:'TAX_NOT_APPROVED'}
 const expectedDigest=Buffer.from(digestPodTaxBasis(resolved),'hex')
 const suppliedDigest=Buffer.from(tax.linesDigest,'hex')
 if(!timingSafeEqual(expectedDigest,suppliedDigest))
  return {ok:false,code:'TAX_NOT_APPROVED'}
 const taxObserved=Date.parse(tax.observedAt)
 const taxCents=toCents(tax.amount)
 if(!Number.isFinite(taxObserved)||taxObserved>nowMs
   ||nowMs-taxObserved>120000||taxCents===null)
  return {ok:false,code:'TAX_NOT_APPROVED'}
 const total=subtotal+shippingCents+taxCents
 if(total>MAX_CENTS)return {ok:false,code:'TOTAL_INVALID'}
 return {ok:true,candidate:{
  currency:resolved.currency,subtotal:asMoney(subtotal),
  shippingTotal:asMoney(shippingCents),taxTotal:asMoney(taxCents),
  grandTotal:asMoney(total),providerShippingOption:selectedOptionId,
  providerQuoteObservedAt:new Date(observed).toISOString(),
  lineCount:resolved.lines.length,paymentReady:false,fulfillmentReady:false,
 }}
}
