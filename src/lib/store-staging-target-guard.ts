/** Fail-closed staging-target identity guard; no network, credentials or mutations. */
const REF=/^[a-z]{20}$/
export function assertIndependentStoreStagingTarget(input:{
 stagingProjectRef:string;productionProjectRef:string;databaseHostname:string
}):void{
 const {stagingProjectRef,productionProjectRef,databaseHostname}=input
 if(!REF.test(stagingProjectRef)||!REF.test(productionProjectRef)
  ||stagingProjectRef===productionProjectRef
  ||databaseHostname!==`db.${stagingProjectRef}.supabase.co`)
  throw new Error('STORE_STAGING_TARGET_NOT_INDEPENDENT')
}
