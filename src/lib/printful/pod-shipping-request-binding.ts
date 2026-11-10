import 'server-only'
import {createHash,timingSafeEqual} from 'node:crypto'
import {validateFullCartPodShipping} from './pod-full-cart-shipping-contract'
import {quoteFullCartPodShipping,type PodFullCartShippingResult} from './pod-full-cart-shipping'
import {evaluatePodQuoteCandidate,type ApprovedPodTaxEvidence,type PodCandidateResult}
 from './pod-shipping-tax-candidate'
import type {ResolvedPodInputs} from './pod-authoritative-input-resolver'

const DIGEST=/^[a-f0-9]{64}$/
const MAX_QUOTE_AGE_MS=120000

/** This is an unkeyed correlation digest, NOT a signature. Only use the
 * bound result inside the same isolated, authenticated worker that obtained
 * the provider response; untrusted JSON can forge these fields.
 */
export type BoundPodShippingEvidence=Readonly<{
 requestDigest:string
 responseDigest:string
 observedAt:string
 shipping:PodFullCartShippingResult
}>

export type BoundPodShippingResult=
 | {ok:true;evidence:BoundPodShippingEvidence}
 | {ok:false;code:'INVALID_REQUEST'|'SHIPPING_UNAVAILABLE'}

function digest(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function matchesDigest(left:string,right:string):boolean{
 if(!DIGEST.test(left)||!DIGEST.test(right))return false
 return timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'))
}

function requestBinding(resolved:ResolvedPodInputs):
 | {ok:true;digest:string}
 | {ok:false}{
 if(!resolved||!Array.isArray(resolved.lines)
    ||!Array.isArray(resolved.shippingLines)
    ||resolved.lines.length!==resolved.shippingLines.length
    ||!Number.isSafeInteger(resolved.shippingLines.length))
  return {ok:false}
 // Correlate each authoritative local variant with the exact catalog variant
 // and quantity used in the provider request, not merely with its line count.
 const byLocal=new Map(resolved.lines.map(line=>[
  line.variantId.toLowerCase(),line,
 ]))
 if(byLocal.size!==resolved.lines.length)return {ok:false}
 for(const line of resolved.shippingLines){
  if(!line||typeof line.localVariantId!=='string')return {ok:false}
  const source=byLocal.get(line.localVariantId.toLowerCase())
  if(!source||source.quantity!==line.quantity
    ||source.catalogVariantId!==String(line.catalogVariantId))
   return {ok:false}
 }
 const validated=validateFullCartPodShipping(
  resolved.destination,resolved.shippingLines,
 )
 if(!validated.ok)return {ok:false}
 const items=[...validated.request.items]
   .sort((a,b)=>a.variant_id-b.variant_id)
 const recipient=validated.request.recipient
 return {ok:true,digest:digest({
  version:1,currency:resolved.currency,customerId:resolved.customerId.toLowerCase(),
  recipient:{
   country_code:recipient.country_code,state_code:recipient.state_code??'',
   zip:recipient.zip,city:recipient.city,
  },items,
 })}
}

function shippingDigest(shipping:PodFullCartShippingResult):string|null{
 if(!shipping.ok||!Array.isArray(shipping.options)
   ||shipping.options.length===0||shipping.options.length>20)
  return null
 const ids=new Set<string>()
 const options=[]
 for(const option of shipping.options){
  if(!option||typeof option.id!=='string'||ids.has(option.id)
    ||typeof option.name!=='string'||typeof option.rate!=='string'
    ||typeof option.currency!=='string')return null
  ids.add(option.id)
  options.push({id:option.id,name:option.name,rate:option.rate,
   currency:option.currency})
 }
 options.sort((a,b)=>a.id.localeCompare(b.id))
 return digest({version:1,lineCount:shipping.lineCount,options})
}

/** One provider quote request for a fully validated, authoritative cart.
 * No customer API route, quote persistence, payment or Printful order action.
 * The returned binding must remain internal to a trusted worker. */
export async function requestBoundPodShipping(
 resolved:ResolvedPodInputs,nowMs=Date.now(),
):Promise<BoundPodShippingResult>{
 const binding=requestBinding(resolved)
 if(!binding.ok||!Number.isSafeInteger(nowMs))
  return {ok:false,code:'INVALID_REQUEST'}
 const shipping=await quoteFullCartPodShipping(
  resolved.destination,resolved.shippingLines,
 )
 if(!shipping.ok)return {ok:false,code:'SHIPPING_UNAVAILABLE'}
 const responseDigest=shippingDigest(shipping)
 if(responseDigest===null||shipping.lineCount!==resolved.shippingLines.length)
  return {ok:false,code:'SHIPPING_UNAVAILABLE'}
 return {ok:true,evidence:{
  requestDigest:binding.digest,responseDigest,
  observedAt:new Date(Date.now()).toISOString(),shipping,
 }}
}

/** Fail closed if the intended cart, destination, currency, provider response,
 * or time changes after quoting. The digest is a correlation check, not
 * authentication of the Printful server or independent tax approval.
 */
export function verifyBoundPodShipping(
 resolved:ResolvedPodInputs,evidence:BoundPodShippingEvidence,nowMs=Date.now(),
):boolean{
 if(!Number.isSafeInteger(nowMs)||!evidence)return false
 const request=requestBinding(resolved)
 if(!request.ok||!matchesDigest(request.digest,evidence.requestDigest))
  return false
 const observed=Date.parse(evidence.observedAt)
 if(!Number.isFinite(observed)||observed>nowMs
   ||nowMs-observed>MAX_QUOTE_AGE_MS)
  return false
 const currentResponse=shippingDigest(evidence.shipping)
 return currentResponse!==null
  &&matchesDigest(currentResponse,evidence.responseDigest)
  &&evidence.shipping.ok
  &&evidence.shipping.lineCount===resolved.shippingLines.length
}

/** This additional gate does not make the candidate persistable/payable.
 * Tax provenance and provider response authenticity still require an
 * independent authorized worker and verified external integrations. */
export function evaluateBoundPodQuoteCandidate(
 resolved:ResolvedPodInputs,evidence:BoundPodShippingEvidence,
 selectedOptionId:string,tax:ApprovedPodTaxEvidence,nowMs=Date.now(),
):PodCandidateResult{
 if(!verifyBoundPodShipping(resolved,evidence,nowMs))
  return {ok:false,code:'SHIPPING_UNAVAILABLE'}
 return evaluatePodQuoteCandidate(resolved,evidence.shipping,
  selectedOptionId,evidence.observedAt,tax,nowMs)
}
