'use server'
import {requireAdmin} from '@/lib/admin-auth'
import {createClient} from '@/lib/supabase/server'
import {getPrintfulProductDetail} from '@/lib/printful/product-detail'
import {reconcilePrintfulVariants,type PrintfulVariantReconciliation} from '@/lib/printful/variant-reconciliation'

const TSHIRT_ID='1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0'
const PRINTFUL_SYNC_PRODUCT=479728769

export type ReconciliationInspection=
 | {ok:true;result:PrintfulVariantReconciliation;note:string}
 | {ok:false;code:'LOCAL_UNAVAILABLE'|'PRINTFUL_UNAVAILABLE'|'INVALID_VARIANTS'}

export async function inspectStoreTshirtPrintfulVariantMapping():Promise<ReconciliationInspection>{
 await requireAdmin()
 const db=await createClient()
 const {data,error}=await db.from('evo_store_variants')
  .select('id,sku').eq('product_id',TSHIRT_ID).order('sku')
 if(error||!data)return {ok:false,code:'LOCAL_UNAVAILABLE'}
 if(data.length!==18||data.some(v=>typeof v.id!=='string'
   ||typeof v.sku!=='string'||!v.sku||v.sku.length>64))
  return {ok:false,code:'INVALID_VARIANTS'}
 const upstream=await getPrintfulProductDetail(PRINTFUL_SYNC_PRODUCT)
 if('error' in upstream)return {ok:false,code:'PRINTFUL_UNAVAILABLE'}
 if(upstream.id!==PRINTFUL_SYNC_PRODUCT||upstream.variants.length!==18)
  return {ok:false,code:'INVALID_VARIANTS'}
 return {
  ok:true,result:reconcilePrintfulVariants(data,upstream),
  note:'SKU matching proves catalog identity only. It does not validate artwork files, stock, print costs, product weights, shipping rates, or production fulfilment.',
 }
}
