import {createClient} from '@supabase/supabase-js'
import {authenticateStoreWorkerOperator} from './store-worker-operator-identity.ts'

type RoleClient=Readonly<{
 auth:{getUser:(jwt:string)=>Promise<{data:{user:{id:string;email_confirmed_at?:string|null}|null};error:unknown}>}
 rpc:(name:string)=>Promise<{data:unknown;error:unknown}>
}>
/**
 * Use an ephemeral, token-bound Supabase client. Auth.getUser validates the
 * token remotely, while the authorization RPC runs using the SAME user JWT.
 * The worker must construct this client internally; no service-role key.
 */
export async function verifyStoreWorkerOperatorLive(
 token:string,
 createTokenBoundClient:(token:string)=>RoleClient,
):Promise<string>{
 const client=createTokenBoundClient(token)
 return authenticateStoreWorkerOperator(token,{
  verifySession:async(jwt)=>{
   const {data,error}=await client.auth.getUser(jwt)
   return error||!data.user?null:{id:data.user.id,emailConfirmed:!!data.user.email_confirmed_at}
  },
  hasLiveReconciliationRole:async(operatorId)=>{
   // Do not trust a user ID in an RPC parameter. Gate uses auth.uid() from JWT.
   const {data:user,error:userError}=await client.auth.getUser(token)
   if(userError||!user.user||user.user.id!==operatorId)return false
   const {data,error}=await client.rpc('can_operate_evo_store_reconciliation')
   return !error&&data===true
  },
 })
}
export function createStoreWorkerTokenBoundClient(
 url:string,publishableKey:string,token:string,
):RoleClient{
 const parsed=new URL(url)
 if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')
  ||!publishableKey||publishableKey.length<8)throw new Error('STORE_WORKER_ROLE_CONFIG_INVALID')
 return createClient(url,publishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{Authorization:`Bearer ${token}`}},
 }) as unknown as RoleClient
}
