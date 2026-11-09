/**
 * Pure full-cart POD shipping request validation. Inputs MUST originate in a
 * separately authorized worker from verified private Printful variant mappings;
 * never construct these lines from client-supplied provider IDs.
 *
 * Provider shipping quotes are estimates, not stock, tax, production or
 * fulfilment approval. No persistent address or quote is created here.
 */
export type PodShippingDestination=Readonly<{
 countryCode:'IN'|'US';stateCode?:string;postalCode:string;city:string
}>
export type TrustedPodShippingLine=Readonly<{
 localVariantId:string;catalogVariantId:number;quantity:number
}>
export type PodShippingRequest=Readonly<{
 recipient:{country_code:'IN'|'US';state_code?:string;zip:string;city:string};
 items:{variant_id:number;quantity:number}[]
}>
export type PodShippingValidation=
 | {ok:true;request:PodShippingRequest}
 | {ok:false;code:'INVALID_DESTINATION'|'INVALID_LINES'|'DUPLICATE_VARIANT'|'EXCESS_QUANTITY'}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const POSTAL=/^[A-Za-z0-9 -]{3,16}$/
const CITY=/^[\p{L}\p{M} .'-]{2,100}$/u

export function validateFullCartPodShipping(
 destination:PodShippingDestination,lines:readonly TrustedPodShippingLine[],
):PodShippingValidation{
 if(!destination||!['IN','US'].includes(destination.countryCode)
  ||typeof destination.postalCode!=='string'||typeof destination.city!=='string'
  ||typeof destination.stateCode!=='string'&&destination.stateCode!==undefined)
  return {ok:false,code:'INVALID_DESTINATION'}
 const postal=destination.postalCode.trim()
 const city=destination.city.trim()
 const state=destination.stateCode?.trim().toUpperCase()
 if(!POSTAL.test(postal)||!CITY.test(city)||(state!==undefined&&!/^[A-Z]{2}$/.test(state))
  ||(destination.countryCode==='US'&&!state))
  return {ok:false,code:'INVALID_DESTINATION'}
 if(!Array.isArray(lines)||lines.length===0||lines.length>50)
  return {ok:false,code:'INVALID_LINES'}
 let totalQty=0
 const local=new Set<string>(),catalog=new Set<number>()
 for(const line of lines){
  if(!line||typeof line.localVariantId!=='string'||!UUID.test(line.localVariantId)
   ||!Number.isSafeInteger(line.catalogVariantId)||line.catalogVariantId<=0
   ||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10)
   return {ok:false,code:'INVALID_LINES'}
  const id=line.localVariantId.toLowerCase()
  if(local.has(id)||catalog.has(line.catalogVariantId))
   return {ok:false,code:'DUPLICATE_VARIANT'}
  local.add(id);catalog.add(line.catalogVariantId)
  totalQty+=line.quantity
 }
 if(totalQty>50)return {ok:false,code:'EXCESS_QUANTITY'}
 return {ok:true,request:{
  recipient:{country_code:destination.countryCode,
   ...(state?{state_code:state}:{}),zip:postal,city},
  items:lines.map(v=>({variant_id:v.catalogVariantId,quantity:v.quantity})),
 }}
}
