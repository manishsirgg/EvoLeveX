/**
 * Staging-only node-postgres configuration contract.
 * The connection string and root certificate MUST originate from trusted
 * server-side secrets. No pg driver is instantiated by this module.
 */
export type StorePgSecrets=Readonly<{
 connectionString:string
 caCertificate:string
}>
export function createStoreStagingPgClientConfig(secrets:StorePgSecrets){
 const url=new URL(secrets.connectionString)
 if(url.protocol!=='postgresql:' && url.protocol!=='postgres:')
  throw new Error('STORE_PG_CONFIG_INVALID')
 if(!url.hostname||!url.username||!url.password||!url.pathname.slice(1)
  ||url.searchParams.has('sslmode')||url.searchParams.has('sslcert')
  ||url.searchParams.has('sslrootcert')||url.searchParams.has('sslkey'))
  throw new Error('STORE_PG_CONFIG_INVALID')
 if(!secrets.caCertificate.includes('-----BEGIN CERTIFICATE-----')
  ||!secrets.caCertificate.includes('-----END CERTIFICATE-----'))
  throw new Error('STORE_PG_CA_REQUIRED')
 return Object.freeze({
  connectionString:secrets.connectionString,
  ssl:Object.freeze({rejectUnauthorized:true as const,ca:secrets.caCertificate}),
  connectionTimeoutMillis:3000,
  query_timeout:3000,
  statement_timeout:3000,
  application_name:'evo-store-staging-role-reader',
 })
}
