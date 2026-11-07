import 'server-only'
import {getPrintfulProductDetail} from '@/lib/printful/product-detail'
import {validateShippingQuoteInput,type QuoteCountry} from '@/lib/printful/shipping-quote-contract'
import {reconcilePrintfulVariants,type LocalPrintfulVariant} from '@/lib/printful/variant-reconciliation'

const STORE_ID='18878485'
const PRODUCT_ID=479728769
const ENDPOINT='https://api.printful.com/shipping/rates'
export type VariantShippingQuoteInput=Readonly<{
 localVariantId:string;country:QuoteCountry;state:string;postal:string;city:string;quantity:number
}>
export type VariantShippingQuoteResult=
 | {ok:true;sku:string;catalogVariantId:number;options:{id:string;name:string;rate:string;currency:string}[];note:string}
 | {ok:false;code:'DISABLED'|'NOT_CONFIGURED'|'INVALID_DESTINATION'|'MAPPING_UNVERIFIED'|'PROVIDER_UNAVAILABLE'|'PROVIDER_REJECTED'}

/** Operator-only read of a one-line indicative shipping rate, never a fulfilment order.
 * Caller must authorize staff and load the exact local product variants under RLS.
 * Deliberately excludes customer PII, payments, addresses and checkout writes.
 */
export async function quoteVerifiedTshirtVariantShipping(
 input:VariantShippingQuoteInput,
 local:readonly LocalPrintfulVariant[],
):Promise<VariantShippingQuoteResult>{
 if(process.env.PRINTFUL_VARIANT_SHIPPING_QUOTES_ENABLED!=='true')
  return {ok:false,code:'DISABLED'}
 const token=process.env.PRINTFUL_API_TOKEN
 if(process.env.PRINTFUL_STORE_ID!==STORE_ID||!token)
  return {ok:false,code:'NOT_CONFIGURED'}
 if(local.length!==18||new Set(local.map(v=>v.id)).size!==18
  ||!local.some(v=>v.id===input.localVariantId))
  return {ok:false,code:'MAPPING_UNVERIFIED'}
 if(!['IN','US'].includes(input.country)||!Number.isSafeInteger(input.quantity)
  ||input.quantity<1||input.quantity>10)
  return {ok:false,code:'INVALID_DESTINATION'}
 const state=input.state.trim().toUpperCase()
 const city=input.city.trim()
 const postal=input.postal.trim()
 // Explicit destination fields, no customer address ever read or stored.
 if(!postal||!city)return {ok:false,code:'INVALID_DESTINATION'}
 const product=await getPrintfulProductDetail(PRODUCT_ID)
 if('error' in product||product.id!==PRODUCT_ID||product.variants.length!==18)
  return {ok:false,code:'PROVIDER_UNAVAILABLE'}
 const mapping=reconcilePrintfulVariants(local,product)
 if(!mapping.readyForMapping)return {ok:false,code:'MAPPING_UNVERIFIED'}
 const requested=local.find(v=>v.id===input.localVariantId)!
 const matches=product.variants.filter(v=>v.sku===requested.sku)
 if(matches.length!==1||!matches[0].synced||!matches[0].catalogId)
  return {ok:false,code:'MAPPING_UNVERIFIED'}
 const validated=validateShippingQuoteInput({
  countryCode:input.country,stateCode:state||undefined,postalCode:postal,
  city,catalogVariantId:matches[0].catalogId,quantity:input.quantity,
 })
 if(!validated.ok)return {ok:false,code:'INVALID_DESTINATION'}
 try{
  const response=await fetch(ENDPOINT,{
   method:'POST',
   headers:{Authorization:`Bearer ${token}`,'X-PF-Store-Id':STORE_ID,
    'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify(validated.request),signal:AbortSignal.timeout(8000),
   redirect:'error',cache:'no-store',
  })
  if(!response.ok)return {ok:false,code:'PROVIDER_REJECTED'}
  const payload:unknown=await response.json()
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
   return {ok:false,code:'PROVIDER_REJECTED'}
  const root=payload as Record<string,unknown>
  if(root.code!==200||!Array.isArray(root.result)||root.result.length>20)
   return {ok:false,code:'PROVIDER_REJECTED'}
  const options:{id:string;name:string;rate:string;currency:string}[]=[]
  const ids=new Set<string>()
  for(const raw of root.result){
   if(!raw||typeof raw!=='object'||Array.isArray(raw))
    return {ok:false,code:'PROVIDER_REJECTED'}
   const v=raw as Record<string,unknown>
   if(typeof v.id!=='string'||v.id.length<1||v.id.length>60||ids.has(v.id)
    ||typeof v.name!=='string'||v.name.length<1||v.name.length>160
    ||typeof v.rate!=='string'||!/^\\d{1,8}(?:\\.\\d{1,2})?$/.test(v.rate)
    ||typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency))
    return {ok:false,code:'PROVIDER_REJECTED'}
   ids.add(v.id)
   options.push({id:v.id,name:v.name,rate:v.rate,currency:v.currency})
  }
  return {ok:true,sku:requested.sku,catalogVariantId:matches[0].catalogId,options,
   note:'Indicative one-line Printful shipping quote only. No retail total, tax calculation, production guarantee, inventory reservation, payment or Printful order. Requote against the actual authorized checkout destination before taking payment.'}
 }catch{return {ok:false,code:'PROVIDER_UNAVAILABLE'}}
}
