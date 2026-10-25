import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/view-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function json(body:object,status=200){
  const response=NextResponse.json(body,{status})
  response.headers.set('Cache-Control','no-store')
  return response
}
export async function POST(request:NextRequest){
  // This endpoint snapshots a nonpayable quote only; never finalizes an order.
  if(process.env.STORE_V1_RESERVATION_UI_ENABLED!=='true'
    ||process.env.STORE_RESERVATION_BRIDGE_ENABLED!=='true')
    return json({error:'Quote preview unavailable'},503)
  if(!isSameOrigin(request))return json({error:'Invalid origin'},403)
  const length=Number(request.headers.get('content-length')??0)
  if(!Number.isFinite(length)||length>512)return json({error:'Invalid request'},400)
  let body:unknown
  try {
    const raw=await request.text()
    if(new TextEncoder().encode(raw).byteLength>512)return json({error:'Invalid request'},400)
    body=JSON.parse(raw)
  }catch{return json({error:'Invalid request'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body)
    ||Object.keys(body).length!==1||!('checkout_id' in body)
    ||typeof body.checkout_id!=='string'||!UUID.test(body.checkout_id))
    return json({error:'Invalid request'},400)
  const supabase=await createClient()
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return json({error:'Sign in required'},401)
  // SQL function verifies the checkout belongs to auth.uid() and is still active.
  const {data,error}=await supabase.rpc('snapshot_evo_store_global_quote',{
    p_checkout_id:body.checkout_id,
  })
  if(error||!data||typeof data!=='object'||Array.isArray(data)
    ||(data as Record<string,unknown>).quote_payable!==false)
    return json({error:'Quote unavailable for this checkout'},409)
  const quote=data as Record<string,unknown>
  // Explicit allowlist: no price is payable and shipping tax is not yet finalized.
  return json({quote:{
    checkout_id:quote.checkout_id,
    country:quote.country,
    currency:quote.currency,
    subtotal_tax_inclusive:quote.subtotal_tax_inclusive,
    included_product_tax:quote.included_product_tax,
    shipping_before_any_applicable_shipping_tax:quote.shipping_before_any_applicable_shipping_tax,
    shipping_tax_status:quote.shipping_tax_status,
    quote_payable:false,
  }})
}
