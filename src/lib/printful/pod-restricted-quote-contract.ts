/**
 * Internal evidence contract for an independently authenticated POD quote worker.
 * NOT an HTTP request DTO. All fields must be independently resolved by the
 * trusted worker from the customer's owned address, live Printful mapping,
 * approved price/tax rules and a fresh full-cart shipping response.
 */
export type TrustedPodQuoteLine=Readonly<{
 productMapId:string;productId:string;variantId:string;
 syncVariantId:string;catalogVariantId:string;sku:string;
 quantity:number;unitPrice:string;
}>
export type TrustedPodQuoteEvidence=Readonly<{
 customerId:string;idempotencyKey:string;printfulStoreId:string;
 currency:string;destinationCountry:'IN'|'US';destinationDigest:string;
 subtotal:string;shippingTotal:string;taxTotal:string;
 providerShippingOption:string;providerQuoteObservedAt:string;
 expiresAt:string;lines:readonly TrustedPodQuoteLine[];
}>
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRICE=/^(0|[1-9][0-9]{0,11})\.[0-9]{2}$/
const ID=/^[1-9][0-9]{0,29}$/
const CURRENCY=/^[A-Z]{3}$/
const SHA256=/^[a-f0-9]{64}$/
const SKU=/^[\x21-\x7e]{1,64}$/
function cents(value:string):bigint|null{
 if(typeof value!=='string'||!PRICE.test(value))return null
 const [major,minor]=value.split('.')
 return BigInt(major)*100n+BigInt(minor)
}
export function validateTrustedPodQuoteEvidence(
 evidence:TrustedPodQuoteEvidence,nowMs=Date.now(),
):{ok:true;subtotalCents:bigint}|{ok:false;code:string}{
 if(!evidence||!Number.isSafeInteger(nowMs)
   ||![evidence.customerId,evidence.idempotencyKey,evidence.printfulStoreId]
    .every(x=>typeof x==='string'&&UUID.test(x))
   ||typeof evidence.currency!=='string'||!CURRENCY.test(evidence.currency)
   ||(evidence.destinationCountry!=='IN'&&evidence.destinationCountry!=='US')
   ||typeof evidence.destinationDigest!=='string'||!SHA256.test(evidence.destinationDigest)
   ||typeof evidence.providerShippingOption!=='string'
   ||!/^[a-zA-Z0-9_-]{1,60}$/.test(evidence.providerShippingOption))
  return {ok:false,code:'IDENTITY_INVALID'}
 const subtotal=cents(evidence.subtotal)
 const shipping=cents(evidence.shippingTotal)
 const tax=cents(evidence.taxTotal)
 if(subtotal===null||shipping===null||tax===null
   ||subtotal<=0n||subtotal+shipping+tax>99999999999999n)
  return {ok:false,code:'MONEY_INVALID'}
 const observed=Date.parse(evidence.providerQuoteObservedAt)
 const expiry=Date.parse(evidence.expiresAt)
 if(!Number.isFinite(observed)||!Number.isFinite(expiry)
   ||observed>nowMs||nowMs-observed>120000
   ||expiry<=nowMs||expiry>nowMs+15*60*1000)
  return {ok:false,code:'QUOTE_STALE'}
 if(!Array.isArray(evidence.lines)||evidence.lines.length<1||evidence.lines.length>50)
  return {ok:false,code:'LINES_INVALID'}
 const seen=new Set<string>()
 let sum=0n,totalQty=0
 for(const line of evidence.lines){
  if(!line||![line.productMapId,line.productId,line.variantId]
   .every(x=>typeof x==='string'&&UUID.test(x))
   ||typeof line.syncVariantId!=='string'||!ID.test(line.syncVariantId)
   ||typeof line.catalogVariantId!=='string'||!ID.test(line.catalogVariantId)
   ||typeof line.sku!=='string'||!SKU.test(line.sku)
   ||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10)
    return {ok:false,code:'LINES_INVALID'}
  const id=line.variantId.toLowerCase()
  if(seen.has(id))return {ok:false,code:'DUPLICATE_VARIANT'}
  seen.add(id)
  const amount=cents(line.unitPrice)
  if(amount===null||amount<=0n)return {ok:false,code:'MONEY_INVALID'}
  sum+=amount*BigInt(line.quantity)
  totalQty+=line.quantity
 }
 if(totalQty>50)return {ok:false,code:'QUANTITY_EXCEEDED'}
 if(sum!==subtotal)return {ok:false,code:'SUBTOTAL_MISMATCH'}
 return {ok:true,subtotalCents:sum}
}
