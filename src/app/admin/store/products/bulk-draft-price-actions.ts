'use server'
import {revalidatePath} from 'next/cache'
import {requireAdmin} from '@/lib/admin-auth'
import {createClient} from '@/lib/supabase/server'
import {parseStoreCurrency,isStoreUuid} from '@/lib/admin-store-validation'

export type BulkDraftPriceResult={error?:string;success?:string}
const MONEY=/^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/
export async function saveBulkInactiveDraftPrices(
 productId:string,currencyInput:string,
 lines:{variant_id:string;amount:string}[],
 confirmed:boolean,
):Promise<BulkDraftPriceResult>{
 await requireAdmin()
 if(!confirmed)return {error:'Confirm that every retail price has been independently verified.'}
 if(!isStoreUuid(productId)||!Array.isArray(lines)||lines.length<1||lines.length>50)
  return {error:'Invalid product or variant count.'}
 const currency=parseStoreCurrency(currencyInput)
 if(!currency)return {error:'Select a supported currency.'}
 if(lines.some(line=>!line||!isStoreUuid(line.variant_id)||typeof line.amount!=='string'
   ||!MONEY.test(line.amount)||Number(line.amount)<=0
   ||(currency==='JPY'&&!line.amount.endsWith('.00')))
   ||new Set(lines.map(l=>l.variant_id)).size!==lines.length)
  return {error:'Enter a unique variant and verified positive two-decimal price for every row.'}
 const supabase=await createClient()
 const {data,error}=await supabase.rpc('seed_evo_store_inactive_draft_prices',{
  p_product_id:productId,p_currency:currency,p_prices:lines,
 })
 if(error||data!==lines.length)
  return {error:'Draft prices were not confirmed. Refresh the product to check existing rows before retrying.'}
 revalidatePath(`/admin/store/products/${productId}`)
 revalidatePath('/admin/store/readiness')
 return {success:`${lines.length} inactive ${currency} draft prices saved. Review each before activation.`}
}
