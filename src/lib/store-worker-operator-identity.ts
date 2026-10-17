/**
 * Staging-only worker authentication boundary. This is not a deployed service.
 * The verifier must be a trusted Supabase Auth getUser(token) adapter created
 * inside an isolated runtime. Authorization must be queried live, not derived
 * from JWT metadata, browser claims or caller JSON.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type VerifiedWorkerOperator=Readonly<{id:string;emailConfirmed:boolean}>
export type WorkerIdentityDependencies=Readonly<{
 verifySession:(token:string)=>Promise<VerifiedWorkerOperator|null>
 hasLiveReconciliationRole:(id:string)=>Promise<boolean>
}>
export async function authenticateStoreWorkerOperator(
 bearerToken:string,
 deps:WorkerIdentityDependencies,
):Promise<string>{
 if(typeof bearerToken!=='string'||bearerToken.length<16||bearerToken.length>8192
   ||/\s/.test(bearerToken))throw new Error('STORE_WORKER_SESSION_INVALID')
 let user:VerifiedWorkerOperator|null
 try{user=await deps.verifySession(bearerToken)}catch{throw new Error('STORE_WORKER_SESSION_UNVERIFIED')}
 if(!user||!UUID.test(user.id)||user.emailConfirmed!==true)
  throw new Error('STORE_WORKER_SESSION_UNVERIFIED')
 let allowed=false
 try{allowed=await deps.hasLiveReconciliationRole(user.id)}catch{
  throw new Error('STORE_WORKER_AUTHORIZATION_UNAVAILABLE')
 }
 if(allowed!==true)throw new Error('STORE_WORKER_OPERATOR_FORBIDDEN')
 return user.id
}
