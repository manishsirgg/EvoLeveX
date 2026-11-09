import 'server-only'
import {validateFullCartPodShipping,type PodShippingDestination,type TrustedPodShippingLine}
 from './pod-full-cart-shipping-contract'

const STORE_ID='18878485'
const ENDPOINT='https://api.printful.com/shipping/rates'
export type PodShippingOption=Readonly<{id:string;name:string;rate:string;currency:string}>
export type PodFullCartShippingResult=
 | {ok:true;options:PodShippingOption[];lineCount:number;note:string}
 | {ok:false;code:'DISABLED'|'NOT_CONFIGURED'|'INVALID_REQUEST'|'PROVIDER_REJECTED'|'PROVIDER_UNAVAILABLE'}

/**
 * Isolated, non-order shipping quote capability. NOT connected to an HTTP
 * endpoint, action, payment flow, checkout, cron or privileged DB worker.
 * The future authorized worker must supply only freshly checked mappings.
 *
 * The shipping/rates API uses POST but DOES NOT create a fulfilment order.
 */
export async function quoteFullCartPodShipping(
 destination:PodShippingDestination,
 verifiedLines:readonly TrustedPodShippingLine[],
):Promise<PodFullCartShippingResult>{
 if(process.env.STORE_POD_FULL_CART_SHIPPING_ENABLED!=='true')
  return {ok:false,code:'DISABLED'}
 const token=process.env.PRINTFUL_API_TOKEN
 if(process.env.PRINTFUL_STORE_ID!==STORE_ID||!token)
  return {ok:false,code:'NOT_CONFIGURED'}
 const checked=validateFullCartPodShipping(destination,verifiedLines)
 if(!checked.ok)return {ok:false,code:'INVALID_REQUEST'}
 try{
  const response=await fetch(ENDPOINT,{
   method:'POST',
   headers:{Authorization:`Bearer ${token}`,'X-PF-Store-Id':STORE_ID,
    'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify(checked.request),
   signal:AbortSignal.timeout(8000),cache:'no-store',redirect:'error',
  })
  if(!response.ok)return {ok:false,code:'PROVIDER_REJECTED'}
  const payload:unknown=await response.json()
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
   return {ok:false,code:'PROVIDER_REJECTED'}
  const root=payload as Record<string,unknown>
  if(root.code!==200||!Array.isArray(root.result)
   ||root.result.length===0||root.result.length>20)
   return {ok:false,code:'PROVIDER_REJECTED'}
  const options:PodShippingOption[]=[]
  const ids=new Set<string>()
  for(const raw of root.result){
   if(!raw||typeof raw!=='object'||Array.isArray(raw))
    return {ok:false,code:'PROVIDER_REJECTED'}
   const v=raw as Record<string,unknown>
   if(typeof v.id!=='string'||v.id.length<1||v.id.length>60||ids.has(v.id)
    ||typeof v.name!=='string'||v.name.length<1||v.name.length>160
    ||typeof v.rate!=='string'||!/^\d{1,8}(?:\.\d{1,2})?$/.test(v.rate)
    ||typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency))
    return {ok:false,code:'PROVIDER_REJECTED'}
   ids.add(v.id)
   options.push({id:v.id,name:v.name,rate:v.rate,currency:v.currency})
  }
  return {ok:true,options,lineCount:checked.request.items.length,
   note:'Read-only full-cart supplier shipping estimate. Does not establish landed cost, taxes, stock availability, a customer checkout total or permission to charge and fulfil. Revalidate all inputs and supplier availability at customer checkout.'}
 }catch{return {ok:false,code:'PROVIDER_UNAVAILABLE'}}
}
