import type {ProductDetail} from '@/lib/printful/product-detail'

export type LocalPrintfulVariant = Readonly<{id:string;sku:string}>
export type PrintfulVariantReconciliation = Readonly<{
 totalLocal:number;totalProvider:number;matched:number;unmatchedLocal:string[];
 unmatchedProvider:string[];duplicateLocal:string[];duplicateProvider:string[];
 unsynced:string[];readyForMapping:boolean;
}>

/** Strict read-only SKU reconciliation, never inferred by size or color. */
export function reconcilePrintfulVariants(
 local:readonly LocalPrintfulVariant[],provider:Pick<ProductDetail,'variants'>,
):PrintfulVariantReconciliation{
 const localCounts=new Map<string,number>()
 const providerCounts=new Map<string,number>()
 for(const v of local)localCounts.set(v.sku,(localCounts.get(v.sku)??0)+1)
 for(const v of provider.variants)if(v.sku)
  providerCounts.set(v.sku,(providerCounts.get(v.sku)??0)+1)
 const duplicateLocal=[...localCounts].filter(([,n])=>n!==1).map(([sku])=>sku)
 const duplicateProvider=[...providerCounts].filter(([,n])=>n!==1).map(([sku])=>sku)
 const unmatchedLocal=local.filter(v=>providerCounts.get(v.sku)!==1).map(v=>v.sku)
 const unmatchedProvider=provider.variants.filter(v=>!v.sku||localCounts.get(v.sku)!==1).map(v=>v.sku??'(missing provider SKU)')
 const unsynced=provider.variants.filter(v=>!v.synced).map(v=>v.sku??'(missing provider SKU)')
 const matched=local.filter(v=>localCounts.get(v.sku)===1&&providerCounts.get(v.sku)===1).length
 return {
  totalLocal:local.length,totalProvider:provider.variants.length,matched,
  unmatchedLocal,unmatchedProvider,duplicateLocal,duplicateProvider,unsynced,
  readyForMapping:local.length>0&&local.length===provider.variants.length&&
   matched===local.length&&duplicateLocal.length===0&&duplicateProvider.length===0&&
   unmatchedLocal.length===0&&unmatchedProvider.length===0&&unsynced.length===0,
 }
}
