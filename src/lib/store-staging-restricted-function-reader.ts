import type {StoreRoleReadOnlyQuery} from './store-staging-live-role-lookup.ts'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Restricted function-only staging role reader (PR #296 fixture contract).
 * The SQL login must have EXECUTE only on this boolean function; it must not
 * have direct SELECT on user_roles/roles or private Store payment privileges.
 */
export const STORE_RESTRICTED_ROLE_FUNCTION_SQL=
 'SELECT test_stage_reader_309.eligible($1::uuid) AS eligible'

export function createStagingStoreRestrictedFunctionRoleLookup(query:StoreRoleReadOnlyQuery){
 return async(operatorId:string):Promise<boolean>=>{
  if(!UUID.test(operatorId))return false
  try{
   const result=await query(STORE_RESTRICTED_ROLE_FUNCTION_SQL,[operatorId])
   return result.rows.length===1 && result.rows[0]?.eligible===true
  }catch{
   throw new Error('STORE_RESTRICTED_ROLE_READER_UNAVAILABLE')
  }
 }
}
