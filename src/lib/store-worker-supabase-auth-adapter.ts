import {createClient} from '@supabase/supabase-js'
import {authenticateStoreWorkerOperator} from './store-worker-operator-identity.ts'

/**
 * Dependency-adapter factory for a FUTURE isolated staging worker.
 * Anon/publishable key is NOT privileged; only the supplied bearer is used.
 * Factory must be instantiated inside a trusted process, not from HTTP input.
 */
export function createStoreWorkerSupabaseAuthAdapter(
 url:string,publishableKey:string,
 hasLiveReconciliationRole:(operatorId:string)=>Promise<boolean>,
){
 const parsed=new URL(url)
 if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')
   ||!publishableKey||publishableKey.length<8)
   throw new Error('STORE_WORKER_AUTH_CONFIG_INVALID')
 const supabase=createClient(url,publishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 })
 return {
  async verifySession(token:string){
   const {data,error}=await supabase.auth.getUser(token)
   if(error||!data.user)return null
   return {id:data.user.id,emailConfirmed:!!data.user.email_confirmed_at}
  },
  hasLiveReconciliationRole,
 }
}

/** No live privileged mutation is available through this adapter. */
export async function verifyStoreWorkerOperatorWithSupabase(
 token:string,url:string,publishableKey:string,
 hasLiveReconciliationRole:(operatorId:string)=>Promise<boolean>,
){
 return authenticateStoreWorkerOperator(token,createStoreWorkerSupabaseAuthAdapter(url,publishableKey,hasLiveReconciliationRole))
}
