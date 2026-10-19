import type {SupabaseClient} from '@supabase/supabase-js'
import type {WorkerIdentityDependencies} from './store-worker-operator-identity.ts'

type AuthOnlyClient=Pick<SupabaseClient,'auth'>
type RoleLookup=(operatorId:string)=>Promise<boolean>

/**
 * Staging-only trusted identity adapter. Construct on the SERVER using an
 * independently configured Supabase client and a privileged, read-only live
 * role lookup. Never expose this adapter or those credentials to the browser.
 * No ticket issuance, SQL privileges or payment side effects occur here.
 */
export function createStagingStoreSupabaseIdentity(
 authClient:AuthOnlyClient,
 liveRoleLookup:RoleLookup,
):WorkerIdentityDependencies{
 return Object.freeze({
  verifySession:async(token:string)=>{
   const {data,error}=await authClient.auth.getUser(token)
   if(error||!data?.user)return null
   return Object.freeze({
    id:data.user.id,
    emailConfirmed:typeof data.user.email_confirmed_at==='string'
      && data.user.email_confirmed_at.length>0,
   })
  },
  hasLiveReconciliationRole:async(operatorId:string)=>{
   // This callback must use a server-owned database connection querying
   // current public.user_roles JOIN public.roles; never JWT app_metadata.
   return (await liveRoleLookup(operatorId))===true
  },
 })
}
