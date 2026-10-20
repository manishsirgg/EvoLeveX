import type {RestrictedPgConnectionFactory} from './store-staging-pg-transport.ts'

/**
 * Staging-only PostgreSQL client lifecycle adapter. Supply a server-owned
 * client constructor; do not instantiate a live client in deployed routes.
 * A fresh client is connected per lookup and always closed on success/error.
 */
export type StagingPgClient=Readonly<{
 connect:()=>Promise<void>
 query:(sql:string,values:readonly string[])=>Promise<Readonly<{rows:readonly Readonly<{eligible:boolean}>[]}>>
 end:()=>Promise<void>
}>
export type StagingPgClientConstructor=(settings:Readonly<{
 ssl:Readonly<{rejectUnauthorized:true}>
 connectionTimeoutMillis:number
 query_timeout:number
 statement_timeout:number
 application_name:string
}>)=>StagingPgClient

export function createStagingPgLifecycleFactory(
 construct:StagingPgClientConstructor,
):RestrictedPgConnectionFactory{
 return async settings=>{
  const client=construct(settings)
  try{
   await client.connect()
  }catch{
   try{await client.end()}catch{/* No secrets in errors. */}
   throw new Error('STORE_READER_CONNECT_FAILED')
  }
  return {
   query:async(sql,values)=>{
    try{
     return await client.query(sql,values)
    }finally{
     try{await client.end()}catch{
      throw new Error('STORE_READER_CLOSE_FAILED')
     }
    }
   },
  }
 }
}
