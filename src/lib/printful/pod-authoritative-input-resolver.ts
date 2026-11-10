import 'server-only'
import {validateFullCartPodShipping,type PodShippingDestination,
 type TrustedPodShippingLine} from './pod-full-cart-shipping-contract'

const ROLE='evo_store_pod_quote_reader'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CURRENCY=/^[A-Z]{3}$/
const MONEY=/^(0|[1-9][0-9]{0,11})\.[0-9]{2}$/

export type PodLookupItem=Readonly<{variantId:string;quantity:number}>
export type PodInputLookup=Readonly<{
 customerId:string;addressId:string;currency:string;items:readonly PodLookupItem[]
}>
export type PodInputSession=Readonly<{
 query:(sql:string,params?:readonly unknown[])=>Promise<Readonly<{rows:readonly Record<string,unknown>[]}>>
}>
export type ResolvedPodLine=Readonly<{
 productMapId:string;productId:string;variantId:string;
 syncVariantId:string;catalogVariantId:string;sku:string;
 quantity:number;unitPrice:string;
}>
export type ResolvedPodInputs=Readonly<{
 destination:PodShippingDestination;lines:readonly ResolvedPodLine[];
 shippingLines:readonly TrustedPodShippingLine[];
 currency:string;customerId:string;
}>

/**
 * Read-only trusted input inspection. No HTTP route, credentials, payment or
 * checkout writes. Requires a future, separately provisioned READ-ONLY role
 * with customer-address ownership enforced in the query.
 *
 * This is NOT authority to persist a quote: the independent worker must still
 * validate production, actual full-cart provider shipping, applicable tax,
 * merchant approval, freshness, replay binding and fulfillment readiness.
 */
export async function resolveAuthoritativePodInputs(
 input:PodInputLookup,session:PodInputSession,
):Promise<ResolvedPodInputs>{
 if(!input||typeof input.customerId!=='string'||!UUID.test(input.customerId)
  ||typeof input.addressId!=='string'||!UUID.test(input.addressId)
  ||typeof input.currency!=='string'||!CURRENCY.test(input.currency)
  ||!Array.isArray(input.items)||input.items.length<1||input.items.length>50)
  throw new Error('STORE_POD_LOOKUP_INVALID')
 const variants=new Set<string>()
 let totalQty=0
 for(const line of input.items){
  if(!line||typeof line.variantId!=='string'||!UUID.test(line.variantId)
    ||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10)
   throw new Error('STORE_POD_LOOKUP_INVALID')
  const id=line.variantId.toLowerCase()
  if(variants.has(id))throw new Error('STORE_POD_LOOKUP_DUPLICATE')
  variants.add(id)
  totalQty+=line.quantity
 }
 if(totalQty>50)throw new Error('STORE_POD_LOOKUP_QUANTITY')
 const role=await session.query('SELECT current_user AS principal, session_user AS login')
 if(role.rows.length!==1||role.rows[0].principal!==ROLE||role.rows[0].login!==ROLE)
  throw new Error('STORE_POD_LOOKUP_PRINCIPAL_DENIED')
 const address=await session.query(
  'SELECT country, state, postal_code, city FROM public.addresses '+
  'WHERE id=$1::uuid AND user_id=$2::uuid',
  [input.addressId,input.customerId],
 )
 if(address.rows.length!==1)throw new Error('STORE_POD_ADDRESS_UNAVAILABLE')
 const a=address.rows[0]
 if(typeof a.country!=='string'||typeof a.postal_code!=='string'||typeof a.city!=='string'
    ||(a.country!=='IN'&&a.country!=='US')
    ||(a.state!==null&&typeof a.state!=='string'))
  throw new Error('STORE_POD_ADDRESS_UNAVAILABLE')
 const destination:PodShippingDestination={
  countryCode:a.country,stateCode:typeof a.state==='string'?a.state:undefined,
  postalCode:a.postal_code,city:a.city,
 }
 const rows=await session.query(
  'SELECT v.id AS variant_id, v.product_id, v.sku, v.weight_g, '+
  'v.is_active AS variant_active, p.is_active AS product_active, '+
  'p.publication_status, p.product_mode, '+
  'pm.id AS product_map_id, pm.store_id, pm.sync_state AS product_sync, '+
  'vm.sync_variant_id, vm.catalog_variant_id, vm.sync_state AS variant_sync, '+
  'price.amount::text AS unit_price, price.currency AS price_currency, '+
  'price.is_active AS price_active '+
  'FROM public.evo_store_variants v '+
  'JOIN public.evo_store_products p ON p.id=v.product_id '+
  'JOIN private.evo_store_printful_variant_maps vm ON vm.variant_id=v.id AND vm.product_id=v.product_id '+
  'JOIN private.evo_store_printful_product_maps pm ON pm.id=vm.product_map_id AND pm.product_id=v.product_id '+
  'JOIN private.evo_store_printful_stores s ON s.id=pm.store_id '+
  'JOIN public.evo_store_variant_prices price ON price.variant_id=v.id AND price.currency=$2::char(3) '+
  'WHERE v.id=ANY($1::uuid[]) AND s.external_store_id=$3::text AND s.sync_enabled=true',
  [input.items.map(v=>v.variantId),input.currency,'18878485'],
 )
 if(rows.rows.length!==input.items.length)
  throw new Error('STORE_POD_MAPPING_UNAVAILABLE')
 const resolved=new Map<string,ResolvedPodLine>()
 for(const row of rows.rows){
  if(typeof row.variant_id!=='string'||!UUID.test(row.variant_id)
    ||typeof row.product_map_id!=='string'||!UUID.test(row.product_map_id)
    ||typeof row.product_id!=='string'||!UUID.test(row.product_id)
    ||typeof row.sku!=='string'||row.sku.length<1||row.sku.length>64
    ||typeof row.sync_variant_id!=='string'||!/^[1-9][0-9]{0,29}$/.test(row.sync_variant_id)
    ||typeof row.catalog_variant_id!=='string'||!/^[1-9][0-9]{0,29}$/.test(row.catalog_variant_id)
    ||typeof row.unit_price!=='string'||!MONEY.test(row.unit_price)
    ||row.product_sync!=='synced'||row.variant_sync!=='synced'
    ||typeof row.price_currency!=='string'||row.price_currency.trim()!==input.currency||row.price_active!==true
    ||row.product_mode!=='physical'
    // A draft cannot be purchased. Publication remains locked for Printful.
    ||row.publication_status!=='published'||row.variant_active!==true
    ||row.product_active!==true||!Number.isSafeInteger(row.weight_g)||row.weight_g<=0)
   throw new Error('STORE_POD_MAPPING_UNAVAILABLE')
  const key=row.variant_id.toLowerCase()
  if(resolved.has(key))throw new Error('STORE_POD_MAPPING_AMBIGUOUS')
  const qty=input.items.find(x=>x.variantId.toLowerCase()===key)?.quantity
  if(!qty)throw new Error('STORE_POD_MAPPING_UNAVAILABLE')
  resolved.set(key,{
   productMapId:row.product_map_id,productId:row.product_id,
   variantId:row.variant_id,syncVariantId:row.sync_variant_id,
   catalogVariantId:row.catalog_variant_id,sku:row.sku,
   quantity:qty,unitPrice:row.unit_price,
  })
 }
 const lines=input.items.map(item=>resolved.get(item.variantId.toLowerCase()))
 if(lines.some(x=>!x))throw new Error('STORE_POD_MAPPING_UNAVAILABLE')
 const verifiedLines=lines as ResolvedPodLine[]
 const shippingLines=verifiedLines.map(v=>({
  localVariantId:v.variantId,catalogVariantId:Number(v.catalogVariantId),
  quantity:v.quantity,
 }))
 if(shippingLines.some(v=>!Number.isSafeInteger(v.catalogVariantId)||v.catalogVariantId<=0))
  throw new Error('STORE_POD_MAPPING_UNAVAILABLE')
 const checked=validateFullCartPodShipping(destination,shippingLines)
 if(!checked.ok)throw new Error('STORE_POD_SHIPPING_INPUT_INVALID')
 return {destination,lines:verifiedLines,shippingLines,
  currency:input.currency,customerId:input.customerId}
}
