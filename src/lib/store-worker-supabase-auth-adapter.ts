import {createClient} from '@supabase/supabase-js'
import {authenticateStoreWorkerOperator} from './store-worker-operator-identity.ts'

/**
 * Dependency-adapter factory for a FUTURE isolated staging worker.
 * Anon/publishable key is NOT privileged; only the supplied bearer is used.
 * Factory must be instantiated inside a trusted process, not from HTTP input.
 */
export function createStoreWorkerSupabaseAuthAdapter(
 url:string,publishableKey:string,
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
  async hasLiveReconciliationRole(_operatorId:string){
   // A separate trusted role query is mandatory. Never infer admin status
   // from JWT metadata or use a service-role client on this read adapter.
   throw new Error('STORE_WORKER_ROLE_ADAPTER_NOT_CONFIGURED')
  },
 }
}

/** No live privileged mutation is available through this adapter. */
export async function verifyStoreWorkerOperatorWithSupabase(
 token:string,url:string,publishableKey:string,
){
 return authenticateStoreWorkerOperator(token,createStoreWorkerSupabaseAuthAdapter(url,publishableKey))
}
