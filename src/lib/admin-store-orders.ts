import 'server-only'
import {createClient} from '@/lib/supabase/server'

export type AdminStoreOrder={
 id:string;status:string;payment_status:string;total_amount:string|number;
 currency:string;created_at:string;checkout_expires_at:string|null;
 order_items:{source:string}[]
}

/** Cookie-authenticated, staff-RLS-scoped read. Does not use a privileged database client. */
export async function getAdminStoreOrders():Promise<{orders:AdminStoreOrder[];error:boolean}>{
 const db=await createClient()
 const {data,error}=await db.from('orders')
  .select('id,status,payment_status,total_amount,currency,created_at,checkout_expires_at,order_items!inner(source)')
  .eq('order_items.source','store')
  .order('created_at',{ascending:false})
  .limit(50)
 if(error)return {orders:[],error:true}
 return {orders:(data??[]) as AdminStoreOrder[],error:false}
}
