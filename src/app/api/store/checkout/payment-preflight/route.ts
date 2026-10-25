import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {isSameOrigin} from '@/lib/view-tracking'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function json(payload:object,status=200){
 const response=NextResponse.json(payload,{status})
 response.headers.set('Cache-Control','no-store')
 return response
}
export async function POST(request:NextRequest){
 // Read-only payment readiness audit. Never initiate Razorpay or create a payment.
 if(process.env.STORE_V1_PAYMENT_PREFLIGHT_UI_ENABLED!=='true'
  ||process.env.STORE_V1_FINALIZATION_UI_ENABLED!=='true'
  ||process.env.STORE_V1_RESERVATION_UI_ENABLED!=='true'
  ||process.env.STORE_RESERVATION_BRIDGE_ENABLED!=='true')
  return json({error:'Payment readiness unavailable'},503)
 if(!isSameOrigin(request))return json({error:'Invalid origin'},403)
 const length=Number(request.headers.get('content-length')??0)
 if(!Number.isFinite(length)||length>512)return json({error:'Invalid request'},400)
 let body:unknown
 try{
  const raw=await request.text()
  if(new TextEncoder().encode(raw).byteLength>512)return json({error:'Invalid request'},400)
  body=JSON.parse(raw)
 }catch{return json({error:'Invalid request'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1
  ||!('order_id' in body)||typeof body.order_id!=='string'||!UUID.test(body.order_id))
  return json({error:'Invalid request'},400)
 const supabase=await createClient()
 const {data:{user},error:authError}=await supabase.auth.getUser()
 if(authError||!user)return json({error:'Sign in required'},401)
 const {data,error}=await supabase.rpc('preflight_evo_store_payment',{p_order_id:body.order_id})
 if(error||!data||typeof data!=='object'||Array.isArray(data))
  return json({error:'Payment readiness could not be confirmed'},409)
 const result=data as Record<string,unknown>
 if(result.order_id!==body.order_id||result.payment_ready!==false
  ||result.requires_provider_capability_check!==true
  ||typeof result.currency!=='string'||!/^[A-Z]{3}$/.test(result.currency)
  ||!['string','number'].includes(typeof result.amount)
  ||!/^\d+(?:\.\d{1,2})?$/.test(String(result.amount))
  ||!Number.isFinite(Number(result.amount))||Number(result.amount)<=0
  ||typeof result.expires_at!=='string'
  ||!Number.isFinite(Date.parse(result.expires_at)))
  return json({error:'Payment readiness could not be confirmed'},409)
 return json({preflight:{
  order_id:result.order_id,amount:String(result.amount),
  currency:result.currency,expires_at:result.expires_at,
  payment_ready:false,requires_provider_capability_check:true,
 }})
}
