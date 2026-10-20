import type {StoreRoleReadOnlyQuery} from './store-staging-live-role-lookup.ts'
import {STORE_RESTRICTED_ROLE_FUNCTION_SQL} from './store-staging-restricted-function-reader.ts'

/**
 * Staging-only restricted query transport. The caller must construct and own
 * the PG connection outside this module. No credentials, pools, routes,
 * migrations or privileged executor are created here.
 */
type QueryResult=Readonly<{rows:readonly Readonly<{eligible:boolean}>[]}>
export type RestrictedPgConnection=Readonly<{
 query:(sql:string,values:readonly string[])=>Promise<QueryResult>
}>
export type RestrictedPgConnectionFactory=(
 settings:Readonly<{
  ssl:Readonly<{rejectUnauthorized:true}>
  connectionTimeoutMillis:number
  query_timeout:number
  statement_timeout:number
  application_name:string
 }>,
)=>Promise<RestrictedPgConnection>

const SETTINGS=Object.freeze({
 ssl:Object.freeze({rejectUnauthorized:true as const}),
 connectionTimeoutMillis:3000,
 query_timeout:3000,
 statement_timeout:3000,
 application_name:'evo-store-staging-role-reader',
})

export function createStagingRestrictedPgTransport(
 connect:RestrictedPgConnectionFactory,
):StoreRoleReadOnlyQuery{
 return async(sql,params)=>{
  if(sql!==STORE_RESTRICTED_ROLE_FUNCTION_SQL
    ||!Array.isArray(params)||params.length!==1)
   throw new Error('STORE_READER_QUERY_DENIED')
  let connection:RestrictedPgConnection
  try{
   connection=await connect(SETTINGS)
   const result=await connection.query(sql,[params[0]])
   if(!result||!Array.isArray(result.rows))
    throw new Error('STORE_READER_RESPONSE_INVALID')
   return result
  }catch{
   throw new Error('STORE_READER_CONNECTION_UNAVAILABLE')
  }
 }
}
