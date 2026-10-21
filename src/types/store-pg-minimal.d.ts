declare module 'pg' {
 export interface ClientConfig {
  host?:string; port?:number; database?:string; user?:string; password?:string
  ssl?:{rejectUnauthorized:boolean;ca:string}
  connectionTimeoutMillis?:number;query_timeout?:number;statement_timeout?:number
  application_name?:string
 }
 export class Client {
  constructor(config?:ClientConfig)
  connect():Promise<void>
  query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>
  end():Promise<void>
 }
 const pg:{Client:typeof Client}
 export default pg
}
