import 'server-only'
import {createClient} from '@/lib/supabase/server'
import {isUuid} from '@/lib/customer-orders'

export type AdminStoreOrderLine = {
 id:string;source:string;product_name_snapshot:string;sku_snapshot:string|null;
 quantity:number;unit_price:number|string;total_price:number|string
}
export type AdminStoreOrderDetail = {
 id:string;status:string;payment_status:string;created_at:string;
 subtotal:number|string;discount_amount:number|string;shipping_amount:number|string;
 tax_amount:number|string;total_amount:number|string;currency:string;
 shipping_name:string|null;shipping_phone:string|null;
 shipping_address_line1:string|null;shipping_address_line2:string|null;
 shipping_landmark:string|null;shipping_city:string|null;shipping_state:string|null;
 shipping_postal_code:string|null;shipping_country:string|null;
 items:AdminStoreOrderLine[]
}

/** Staff-authenticated RLS read; a Store item must exist before returning any order. */
export async function getAdminStoreOrderDetail(id:string):Promise<
 {order:AdminStoreOrderDetail|null;error:boolean}
>{
 if(!isUuid(id))return {order:null,error:false}
 const db=await createClient()
 const {data:match,error:matchError}=await db.from('order_items')
  .select('id').eq('order_id',id).eq('source','store').limit(1)
 if(matchError)return {order:null,error:true}
 if(!match?.length)return {order:null,error:false}
 const [orderResult,itemsResult]=await Promise.all([
  db.from('orders').select(
   'id,status,payment_status,created_at,subtotal,discount_amount,shipping_amount,tax_amount,total_amount,currency,shipping_name,shipping_phone,shipping_address_line1,shipping_address_line2,shipping_landmark,shipping_city,shipping_state,shipping_postal_code,shipping_country'
  ).eq('id',id).maybeSingle(),
  db.from('order_items').select('id,source,product_name_snapshot,sku_snapshot,quantity,unit_price,total_price')
   .eq('order_id',id).order('id'),
 ])
 if(orderResult.error||itemsResult.error)return {order:null,error:true}
 if(!orderResult.data)return {order:null,error:false}
 return {order:{...orderResult.data,items:itemsResult.data??[]} as AdminStoreOrderDetail,error:false}
}
