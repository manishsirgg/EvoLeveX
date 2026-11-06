'use server'
import {revalidatePath} from 'next/cache'
import {requireAdmin} from '@/lib/admin-auth'
import {createClient} from '@/lib/supabase/server'
import {isStoreUuid} from '@/lib/admin-store-validation'

export type BulkWeightResult={error?:string;success?:string}

/** Records only independently verified positive gram weights, never estimates. */
export async function saveVerifiedDraftWeights(
 productId:string,lines:{variant_id:string;weight_g:number}[],confirmed:boolean,
):Promise<BulkWeightResult>{
 await requireAdmin()
 if(!confirmed)return {error:'Confirm that each weight was independently verified.'}
 if(!isStoreUuid(productId)||!Array.isArray(lines)||lines.length<1||lines.length>50)
  return {error:'Invalid product or variant count.'}
 if(lines.some(l=>!l||!isStoreUuid(l.variant_id)
   ||!Number.isSafeInteger(l.weight_g)||l.weight_g<1||l.weight_g>2147483647)
   ||new Set(lines.map(l=>l.variant_id)).size!==lines.length)
  return {error:'Provide a unique variant and verified positive weight in grams for every row.'}
 const db=await createClient()
 const {data,error}=await db.rpc('seed_evo_store_verified_draft_weights',{
  p_product_id:productId,p_weights:lines,
 })
 if(error||data!==lines.length)
  return {error:'Weights were not confirmed. Refresh and inspect existing records before retrying.'}
 revalidatePath(`/admin/store/products/${productId}`)
 revalidatePath('/admin/store/readiness')
 return {success:`${lines.length} verified weights saved. Product and variants remain unchanged in publication state.`}
}
