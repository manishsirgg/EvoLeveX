import {Client} from 'pg'

/**
 * Read-only post-deployment Store migration audit. No migrations are applied.
 * Supply a dedicated READ-ONLY database URL, not a customer or service key.
 */
export const REQUIRED_STORE_OBJECTS=Object.freeze([
 {label:'PR #363 bulk draft prices',kind:'function',name:'public.seed_evo_store_inactive_draft_prices(uuid,text,jsonb)'},
 {label:'PR #364 bulk variant weights',kind:'function',name:'public.seed_evo_store_verified_draft_weights(uuid,jsonb)'},
 {label:'PR #367 Printful mapping read',kind:'function',name:'public.is_evo_store_printful_mapped_product(uuid)'},
 {label:'PR #369 POD quote snapshots',kind:'table',name:'private.evo_store_pod_quote_snapshots'},
 {label:'PR #369 POD quote lines',kind:'table',name:'private.evo_store_pod_quote_lines'},
 {label:'PR #367 stock mutation guard',kind:'trigger',name:'public.evo_store_inventory.evo_store_printful_no_fictitious_stock'},
 {label:'PR #367 mapping mutation guard',kind:'trigger',name:'private.evo_store_printful_variant_maps.evo_store_printful_mapping_no_warehouse_stock'},
 {label:'POD publication lock',kind:'trigger',name:'public.evo_store_products.evo_store_printful_publication_block'},
 {label:'POD variant activation lock',kind:'trigger',name:'public.evo_store_variants.evo_store_printful_variant_activation_block'},
])

export async function inspectStoreDatabaseDeployment(query){
 const names=REQUIRED_STORE_OBJECTS.map(x=>x.name)
 const {rows}=await query(`
 select kind,name,installed from (
  select 'function'::text kind, x.name,
   to_regprocedure(x.name) is not null as installed
   from unnest($1::text[]) x(name)
   where x.name like '%(%'
  union all
  select 'table',x.name,to_regclass(x.name) is not null
   from unnest($1::text[]) x(name)
   where x.name like 'private.%' and x.name not like '%(%'
  union all
  select 'trigger',x.name,exists(
   select 1 from pg_catalog.pg_trigger t
   join pg_catalog.pg_class c on c.oid=t.tgrelid
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where not t.tgisinternal and n.nspname||'.'||c.relname||'.'||t.tgname=x.name
    and t.tgenabled<>'D'
  )
  from unnest($1::text[]) x(name)
  where x.name like 'public.%.%' or x.name like 'private.%.%.%'
 ) checks
 `,[names])
 const keyed=new Map(rows.map(x=>[`${x.kind}:${x.name}`,x.installed===true]))
 const results=REQUIRED_STORE_OBJECTS.map(x=>({
  ...x,installed:keyed.get(`${x.kind}:${x.name}`)===true,
 }))
 return {ready:results.every(x=>x.installed),results}
}

export async function runStoreDeploymentAudit(){
 const connectionString=process.env.STORE_MIGRATION_AUDIT_DATABASE_URL
 if(!connectionString)throw new Error('STORE_AUDIT_DATABASE_URL_NOT_CONFIGURED')
 const client=new Client({
  connectionString,
  ssl:{rejectUnauthorized:true,...(process.env.STORE_MIGRATION_AUDIT_CA_PEM
    ?{ca:process.env.STORE_MIGRATION_AUDIT_CA_PEM}: {})},
  connectionTimeoutMillis:8000,
  query_timeout:10000,
  application_name:'evo-store-schema-audit',
 })
 try{
  await client.connect()
  await client.query('BEGIN READ ONLY')
  const audit=await inspectStoreDatabaseDeployment((sql,params)=>client.query(sql,params))
  for(const result of audit.results){
   process.stdout.write(`${result.installed?'PASS':'MISSING'} | ${result.label} | ${result.name}\n`)
  }
  await client.query('ROLLBACK')
  if(!audit.ready)process.exitCode=1
  return audit.ready
 }finally{
  await client.end()
 }
}

if(process.argv[1] && import.meta.url===new URL(`file://${process.argv[1]}`).href){
 runStoreDeploymentAudit().catch(error=>{
  // No raw provider errors: connection strings and other secrets can be embedded.
  console.error('Store database deployment audit failed. Check read-only TLS connection and permissions.')
  process.exitCode=1
 })
}
