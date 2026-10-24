import 'server-only'
import pg from 'pg'
import {createStagingPgLifecycleFactory} from './store-staging-pg-client-lifecycle.ts'
import {createStagingRestrictedPgTransport} from './store-staging-pg-transport.ts'
import {createStagingStoreRestrictedFunctionRoleLookup} from './store-staging-restricted-function-reader.ts'

/**
 * Staging-only composition. Credentials and trusted CA are injected by a
 * separate reviewed server-side bootstrap; never supplied by HTTP clients.
 * This module creates NO connection until the returned lookup is invoked.
 */
const HOSTNAME=/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i
const ROLE=/^evo_store_role_reader_login$/
const PEM=/^-----BEGIN CERTIFICATE-----[\\s\\S]+-----END CERTIFICATE-----\\s*$/

export function createStagingNodePgRoleLookup(config:Readonly<{
 host:string;port:number;database:string;user:string;password:string;ca:string
}>){
 if(!HOSTNAME.test(config.host)||config.host.toLowerCase()==='localhost'\n   ||!ROLE.test(config.user)||!Number.isInteger(config.port)||config.port<1||config.port>65535
   ||!config.database||!config.user||!config.password
   ||!PEM.test(config.ca))
  throw new Error('STORE_STAGING_PG_CONFIG_INVALID')
 const factory=createStagingPgLifecycleFactory(settings=>{
  const client=new pg.Client({
   host:config.host,port:config.port,database:config.database,
   user:config.user,password:config.password,
   ssl:{rejectUnauthorized:true,ca:config.ca},
   connectionTimeoutMillis:settings.connectionTimeoutMillis,
   query_timeout:settings.query_timeout,
   statement_timeout:settings.statement_timeout,
   application_name:settings.application_name,
  })
  return {
   connect:()=>client.connect(),
   query:async(sql,params)=>{
    const result=await client.query(sql,[...params])
    return {rows:result.rows}
   },
   end:()=>client.end(),
  }
 })
 return createStagingStoreRestrictedFunctionRoleLookup(
  createStagingRestrictedPgTransport(factory))
}
