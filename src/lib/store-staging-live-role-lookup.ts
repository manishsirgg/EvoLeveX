/**
 * Staging-only, server-owned PostgreSQL role lookup. The caller MUST supply a
 * separate trusted read-only connection; do not accept a client-supplied SQL
 * executor, service-role key, table name or role code.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const STORE_ADMIN_ELIGIBILITY_SQL=`
 SELECT EXISTS (
   SELECT 1 FROM public.user_roles AS ur
   JOIN public.roles AS r ON r.id=ur.role_id
   WHERE ur.user_id=$1::uuid AND r.code IN ('admin','super_admin')
 ) AS eligible
`

export type StoreRoleReadOnlyQuery=(
 sql:string,params:readonly [string],
)=>Promise<Readonly<{rows:readonly Readonly<{eligible:boolean}>[]}>>

/** Current DB state is checked at every call; errors fail closed. */
export function createStagingStoreLiveRoleLookup(query:StoreRoleReadOnlyQuery){
 return async(operatorId:string):Promise<boolean>=>{
  if(!UUID.test(operatorId))return false
  try{
   const response=await query(STORE_ADMIN_ELIGIBILITY_SQL,[operatorId])
   return response.rows.length===1 && response.rows[0]?.eligible===true
  }catch{
   throw new Error('STORE_LIVE_ROLE_LOOKUP_UNAVAILABLE')
  }
 }
}
