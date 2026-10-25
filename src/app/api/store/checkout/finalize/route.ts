import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {isSameOrigin} from '@/lib/view-tracking'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail=(message:string,status:number)=>{
 const response=NextResponse.json({error:message},{status})
 response.headers.set('Cache-Control','no-store')
 return response
}
export async function POST(request:NextRequest){
 // Merchant financial clearance must already be reviewed and installed.
 // This endpoint never requests Razorpay payment or triggers Printful.
 if(process.env.STORE_V1_FINALIZATION_UI_ENABLED!=='true'
   ||process.env.STORE_V1_RESERVATION_UI_ENABLED!=='true'
   ||process.env.STORE_RESERVATION_BRIDGE_ENABLED!=='true')
   return fail('Order finalization unavailable',503)
 if(!isSameOrigin(request))return fail('Invalid origin',403)
 const length=Number(request.headers.get('content-length')??0)
 if(!Number.isFinite(length)||length>512)return fail('Invalid request',400)
 let body:unknown
 try{
  const raw=await request.text()
  if(new TextEncoder().encode(raw).byteLength>512)return fail('Invalid request',400)
  body=JSON.parse(raw)
 }catch{return fail('Invalid request',400)}
 if(!body||typeof body!=='object'||Array.isArray(body)
  ||Object.keys(body).length!==1||!('checkout_id' in body)
  ||typeof body.checkout_id!=='string'||!UUID.test(body.checkout_id))
  return fail('Invalid request',400)
 const supabase=await createClient()
 const {data:{user},error:authError}=await supabase.auth.getUser()
 if(authError||!user)return fail('Sign in required',401)
 // Owner-scoped SECURITY DEFINER RPC must validate active hold, live policy
 // clearance, shipping tax and idempotent order linkage transactionally.
 const {data,error}=await supabase.rpc('finalize_evo_store_merchant_order',{
  p_checkout_id:body.checkout_id,
 })
 if(error||!data||typeof data!=='object'||Array.isArray(data))
  return fail('Final charges are not available for this order',409)
 const order=data as Record<string,unknown>
 if(typeof order.order_id!=='string'||!UUID.test(order.order_id)
  ||typeof order.currency!=='string'||!(/^[A-Z]{3}$/).test(order.currency)
  ||!['string','number'].includes(typeof order.amount)
  ||!/^\d+(?:\.\d{1,2})?$/.test(String(order.amount))
  ||Number(order.amount)<=0||!Number.isFinite(Number(order.amount))
  ||typeof order.created!=='boolean')
  return fail('Final charges are not available for this order',409)
 const response=NextResponse.json({order:{
  order_id:order.order_id,currency:order.currency,
  amount:String(order.amount),created:order.created,
  payment_enabled:false,
 }})
 response.headers.set('Cache-Control','no-store')
 return response
}
