import 'server-only'
import {createClient} from '@/lib/supabase/server'

export type StoreCatalogReadinessRow=Readonly<{
 id:string;name:string;publication_status:string;variantCount:number;activeCount:number;
 missingWeight:number;missingActivePrice:number;missingInventory:number;
}>
export type StoreCatalogReadinessResult=Readonly<{products:StoreCatalogReadinessRow[];error:boolean}>

/** Read-only, authenticated Store launch checklist based on authoritative rows.
 * Readiness is advisory: supplier shipping, costs and fulfilment still require
 * independent confirmation before publication or payments.
 */
export async function getStoreCatalogReadiness():Promise<StoreCatalogReadinessResult>{
 const supabase=await createClient()
 const [productsResult,variantsResult]=await Promise.all([
  supabase.from('evo_store_products').select('id,name,publication_status').order('name'),
  supabase.from('evo_store_variants').select('id,product_id,is_active,weight_g'),
 ])
 if(productsResult.error||variantsResult.error)return {products:[],error:true}
 const variants=variantsResult.data??[]
 const variantIds=variants.map(v=>v.id)
 if(!variantIds.length)return {products:(productsResult.data??[]).map(p=>({
  ...p,variantCount:0,activeCount:0,missingWeight:0,missingActivePrice:0,missingInventory:0,
 })),error:false}
 const [pricesResult,stockResult]=await Promise.all([
  supabase.from('evo_store_variant_prices').select('variant_id,amount,is_active').in('variant_id',variantIds),
  supabase.from('evo_store_inventory').select('variant_id').in('variant_id',variantIds),
 ])
 if(pricesResult.error||stockResult.error)return {products:[],error:true}
 const priced=new Set((pricesResult.data??[])
  .filter(p=>p.is_active&&Number.isFinite(Number(p.amount))&&Number(p.amount)>0)
  .map(p=>p.variant_id))
 const stocked=new Set((stockResult.data??[]).map(i=>i.variant_id))
 const byProduct=new Map<string,typeof variants>()
 for(const variant of variants){
  byProduct.set(variant.product_id,[...(byProduct.get(variant.product_id)??[]),variant])
 }
 const products=(productsResult.data??[]).map(product=>{
  const items=byProduct.get(product.id)??[]
  return {
   ...product,
   variantCount:items.length,
   activeCount:items.filter(v=>v.is_active).length,
   missingWeight:items.filter(v=>v.weight_g==null||v.weight_g<=0).length,
   missingActivePrice:items.filter(v=>!priced.has(v.id)).length,
   missingInventory:items.filter(v=>!stocked.has(v.id)).length,
  }
 })
 return {products,error:false}
}
