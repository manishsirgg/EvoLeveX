'use server'
import {requireAdmin} from '@/lib/admin-auth'
import {createClient} from '@/lib/supabase/server'
import {quoteVerifiedTshirtVariantShipping,type VariantShippingQuoteInput,type VariantShippingQuoteResult} from '@/lib/printful/verified-variant-shipping'

const PRODUCT_ID='1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function inspectVerifiedTshirtShipping(
 input:VariantShippingQuoteInput,
):Promise<VariantShippingQuoteResult>{
 await requireAdmin()
 if(!input||typeof input.localVariantId!=='string'
  ||!UUID.test(input.localVariantId)
  ||!['IN','US'].includes(input.country)
  ||typeof input.state!=='string'||typeof input.postal!=='string'
  ||typeof input.city!=='string'||!Number.isSafeInteger(input.quantity))
  return {ok:false,code:'INVALID_DESTINATION'}
 // The exact variant list is reloaded inside the authenticated session.
 // Never trust SKUs, catalog variant IDs or provider prices sent by a browser.
 const db=await createClient()
 const {data,error}=await db.from('evo_store_variants')
  .select('id,sku').eq('product_id',PRODUCT_ID).order('sku')
 if(error||!data)return {ok:false,code:'MAPPING_UNVERIFIED'}
 return quoteVerifiedTshirtVariantShipping(input,data)
}
