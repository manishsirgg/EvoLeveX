import 'server-only'
import type {ProductionConfigurationResult} from '@/lib/printful/production-configuration'
import type {PrintfulVariantReconciliation} from '@/lib/printful/variant-reconciliation'

export type LocalTshirtReadiness=Readonly<{
 sku:string;weight_g:number|null;is_active:boolean;
 hasActivePrice:boolean;hasInventory:boolean;
}>
export type ProductionPreflightIssue=Readonly<{
 code:'SKU_NOT_MATCHED'|'PROVIDER_NOT_SYNCED'|'PRODUCTION_FILES_MISSING'|'PRODUCTION_FILES_UNKNOWN'|
 'PRODUCTION_FILE_ID_MISSING'|'CATALOG_VARIANT_MISSING'|'WEIGHT_MISSING'|'ACTIVE_PRICE_MISSING'|
 'INVENTORY_UNCONFIGURED'|'LOCAL_VARIANT_ACTIVE'|'PROVIDER_VARIANT_DUPLICATE';
 sku:string;
}>
export type ProductionPreflightSummary=Readonly<{
 examined:number;mappingMatches:boolean;issues:ProductionPreflightIssue[];
 productionEvidenceComplete:boolean;commerceReady:false;
}>

/** No physical-stock inference. Only verifies presence of file metadata and
 * local prerequisites; manual artwork, provider production costs, shipping,
 * contractual availability and payment/fulfilment checks remain mandatory.
 */
export function assessTshirtProductionPreflight(
 local:readonly LocalTshirtReadiness[],mapping:PrintfulVariantReconciliation,
 upstream:ProductionConfigurationResult,
):ProductionPreflightSummary{
 const issues:ProductionPreflightIssue[]=[]
 const push=(sku:string,code:ProductionPreflightIssue['code'])=>issues.push({sku,code})
 const provider=upstream.ok?upstream.variants:[]
 const providerCounts=new Map<string,number>()
 for(const v of provider)if(v.sku)providerCounts.set(v.sku,(providerCounts.get(v.sku)??0)+1)
 const bySku=new Map(provider.filter(v=>v.sku&&providerCounts.get(v.sku)===1).map(v=>[v.sku!,v]))
 for(const item of local){
  const v=bySku.get(item.sku)
  if(!v)push(item.sku,'SKU_NOT_MATCHED')
  if((providerCounts.get(item.sku)??0)>1)push(item.sku,'PROVIDER_VARIANT_DUPLICATE')
  if(v){
   if(!v.synced)push(item.sku,'PROVIDER_NOT_SYNCED')
   if(v.catalogVariantId===null)push(item.sku,'CATALOG_VARIANT_MISSING')
   if(v.evidence==='CONFIGURATION_UNKNOWN')push(item.sku,'PRODUCTION_FILES_UNKNOWN')
   if(v.evidence==='NO_FILES_REPORTED'||v.productionFiles===0)push(item.sku,'PRODUCTION_FILES_MISSING')
   if(v.placements.some(p=>p.unresolvedFileIds>0))push(item.sku,'PRODUCTION_FILE_ID_MISSING')
  }
  if(item.weight_g===null||item.weight_g<=0)push(item.sku,'WEIGHT_MISSING')
  if(!item.hasActivePrice)push(item.sku,'ACTIVE_PRICE_MISSING')
  if(!item.hasInventory)push(item.sku,'INVENTORY_UNCONFIGURED')
  if(item.is_active)push(item.sku,'LOCAL_VARIANT_ACTIVE')
 }
 return {
  examined:local.length,
  mappingMatches:mapping.readyForMapping&&upstream.ok&&provider.length===local.length,
  issues,
  productionEvidenceComplete:mapping.readyForMapping&&upstream.ok&&provider.length===local.length&&
   local.length>0&&local.every(v=>{
    const p=bySku.get(v.sku)
    return p?.synced===true&&p.catalogVariantId!==null&&p.evidence==='FILES_PRESENT'
      &&p.productionFiles>0&&p.placements.every(x=>x.unresolvedFileIds===0)
   }),
  commerceReady:false,
 }
}
