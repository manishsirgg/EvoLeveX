'use server'
import {requireAdmin} from '@/lib/admin-auth'
import {createClient} from '@/lib/supabase/server'
import {getPrintfulProductDetail} from '@/lib/printful/product-detail'
import {inspectPrintfulProductionConfiguration} from '@/lib/printful/production-configuration'
import {reconcilePrintfulVariants} from '@/lib/printful/variant-reconciliation'
import {assessTshirtProductionPreflight,type ProductionPreflightSummary} from '@/lib/printful/tshirt-production-preflight'

const PRODUCT_ID='1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0'
const PRINTFUL_ID=479728769

export type TshirtProductionInspection=
 | {ok:true;summary:ProductionPreflightSummary;note:string}
 | {ok:false;code:'LOCAL_UNAVAILABLE'|'PROVIDER_UNAVAILABLE'|'PRODUCT_STATE_INVALID'}

/** Staff-only, strictly read-only operational check; never an approval to fulfil. */
export async function inspectTshirtProductionPreflight():Promise<TshirtProductionInspection>{
 await requireAdmin()
 const db=await createClient()
 const [product,variants,upstream,production]=await Promise.all([
  db.from('evo_store_products').select('id,publication_status').eq('id',PRODUCT_ID).maybeSingle(),
  db.from('evo_store_variants').select('id,sku,is_active,weight_g').eq('product_id',PRODUCT_ID),
  getPrintfulProductDetail(PRINTFUL_ID),
  inspectPrintfulProductionConfiguration(),
 ])
 if(product.error||variants.error||!variants.data)return {ok:false,code:'LOCAL_UNAVAILABLE'}
 if(!product.data||product.data.publication_status!=='draft'||variants.data.length!==18)
  return {ok:false,code:'PRODUCT_STATE_INVALID'}
 if('error' in upstream||!production.ok||upstream.id!==PRINTFUL_ID
   ||upstream.variants.length!==18)return {ok:false,code:'PROVIDER_UNAVAILABLE'}
 const rows=variants.data
 if(rows.some(v=>typeof v.id!=='string'||typeof v.sku!=='string'||!v.sku))
  return {ok:false,code:'LOCAL_UNAVAILABLE'}
 const ids=rows.map(v=>v.id)
 const [prices,inventory]=await Promise.all([
  db.from('evo_store_variant_prices').select('variant_id,is_active,amount').in('variant_id',ids),
  db.from('evo_store_inventory').select('variant_id').in('variant_id',ids),
 ])
 if(prices.error||inventory.error)return {ok:false,code:'LOCAL_UNAVAILABLE'}
 const activePrices=new Set((prices.data??[])
  .filter(p=>p.is_active&&Number.isFinite(Number(p.amount))&&Number(p.amount)>0)
  .map(p=>p.variant_id))
 const inventoryIds=new Set((inventory.data??[]).map(i=>i.variant_id))
 const mapping=reconcilePrintfulVariants(rows,upstream)
 const summary=assessTshirtProductionPreflight(rows.map(v=>({
  sku:v.sku,weight_g:v.weight_g,is_active:v.is_active,
  hasActivePrice:activePrices.has(v.id),hasInventory:inventoryIds.has(v.id),
 })),mapping,production)
 return {ok:true,summary,
  note:'A complete file-metadata inspection is not artwork approval, an available-stock guarantee, a landed-cost quote, a valid checkout shipping price, or authorization to place Printful orders. Customer payments and provider fulfilment remain disabled.'}
}
