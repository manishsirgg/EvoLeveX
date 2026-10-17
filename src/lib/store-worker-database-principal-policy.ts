/**
 * Proposed isolated worker DB principal policy. This is a pure review contract:
 * it never connects to PostgreSQL, grants a role or authorizes a mutation.
 * PostgreSQL CURRENT_USER is authenticated by the DB connection, unlike
 * spoofable request.jwt.claim.sub session settings.
 */
export type WorkerDatabasePrincipalPolicy=Readonly<{
 loginRole:string
 expectedRole:string
 isSuperuser:boolean
 canCreateRole:boolean
 canBypassRls:boolean
 canInherit:boolean
 connectionUsesTls:boolean
 secretSource:string
 }>
const ROLE=/^[a-z][a-z0-9_]{2,62}$/
export function assertRestrictedWorkerDatabasePrincipal(policy:WorkerDatabasePrincipalPolicy):void{
 if(!ROLE.test(policy.loginRole)||policy.loginRole!==policy.expectedRole
 ||policy.loginRole==='postgres'||policy.loginRole==='service_role'
 ||policy.loginRole==='authenticated'||policy.loginRole==='anon')
  throw new Error('STORE_WORKER_DB_PRINCIPAL_INVALID')
 if(policy.isSuperuser||policy.canCreateRole||policy.canBypassRls||policy.canInherit)
  throw new Error('STORE_WORKER_DB_PRIVILEGE_EXCESSIVE')
 if(!policy.connectionUsesTls||policy.secretSource!=='dedicated-secret-manager')
  throw new Error('STORE_WORKER_DB_CONNECTION_UNTRUSTED')
}
