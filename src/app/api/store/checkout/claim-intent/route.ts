import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {isSameOrigin} from '@/lib/view-tracking'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const VALID_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function respond(payload:object,status=200){const r=NextResponse.json(payload,{status});r.headers.set('Cache-Control','no-store');return r}
export async function POST(request:NextRequest){
 // Claim only; never create a Razorpay order or a payment.
 if(process.env.STORE_V1_INTENT_CLAIM_UI_ENABLED!=='true'
  ||process.env.STORE_V1_PAYMENT_PREFLIGHT_UI_ENABLED!=='true'
  ||process.env.STORE_V1_FINALIZATION_UI_ENABLED!=='true'
  ||process.env.STORE_V1_RESERVATION_UI_ENABLED!=='true'
  ||process.env.STORE_RESERVATION_BRIDGE_ENABLED!=='true')
  return respond({error:'Payment intent unavailable'},503)
 if(!isSameOrigin(request))return respond({error:'Invalid origin'},403)
 const size=Number(request.headers.get('content-length')??0)
 if(!Number.isFinite(size)||size>512)return respond({error:'Invalid request'},400)
 let body:unknown
 try{const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>512)return respond({error:'Invalid request'},400);body=JSON.parse(raw)}
 catch{return respond({error:'Invalid request'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==2
  ||!('order_id' in body)||!('idempotency_key' in body)
  ||typeof body.order_id!=='string'||!VALID_UUID.test(body.order_id)
  ||typeof body.idempotency_key!=='string'||!VALID_UUID.test(body.idempotency_key))
  return respond({error:'Invalid request'},400)
 const supabase=await createClient()
 const {data:{user},error:authError}=await supabase.auth.getUser()
 if(authError||!user)return respond({error:'Sign in required'},401)
 const {data,error}=await supabase.rpc('claim_evo_store_razorpay_intent',{
  p_order_id:body.order_id,p_idempotency_key:body.idempotency_key,
 })
 if(error||!data||typeof data!=='object'||Array.isArray(data))
  return respond({error:'Intent could not be reserved'},409)
 const intent=data as Record<string,unknown>
 if(typeof intent.intent_id!=='string'||!VALID_UUID.test(intent.intent_id)
  ||intent.order_id!==body.order_id||typeof intent.currency!=='string'
  ||!/^[A-Z]{3}$/.test(intent.currency)
  ||!['string','number'].includes(typeof intent.amount)
  ||!/^\d+(?:\.\d{1,2})?$/.test(String(intent.amount))
  ||!Number.isFinite(Number(intent.amount))||Number(intent.amount)<=0
  ||typeof intent.created!=='boolean'
  ||intent.provider_order_created!==false||intent.payment_ready!==false)
  return respond({error:'Intent could not be reserved'},409)
 return respond({intent:{intent_id:intent.intent_id,order_id:intent.order_id,
  amount:String(intent.amount),currency:intent.currency,created:intent.created,
  provider_order_created:false,payment_ready:false}})
}
