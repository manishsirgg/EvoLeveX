import {randomBytes} from 'node:crypto'
import {establishStoreOperatorBinding,revalidateStoreOperatorBinding,type StoreOperatorBinding} from './store-worker-operator-binding.ts'
import type {WorkerIdentityDependencies} from './store-worker-operator-identity.ts'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type StoreTicketIssueRequest=Readonly<{attemptId:string;operatorId:string;ticket:string;expiresAt:string}>
/**
 * Staging-only issuance composition. The issuer callback is trusted and
 * injected, not a database client supplied by a caller. Not a live issuer.
 */
export async function issueBoundStoreOperatorTicket(
 bearerToken:string,
 attemptId:string,
 identity:WorkerIdentityDependencies,
 deps:Readonly<{
  validateAttemptForOperator:(attemptId:string,operatorId:string)=>Promise<boolean>
  issueTicket:(request:StoreTicketIssueRequest)=>Promise<void>
 }>,
 now=Date.now(),
):Promise<Readonly<{ticket:string;operatorId:string;attemptId:string;binding:StoreOperatorBinding}>>{
 if(!UUID.test(attemptId)||!Number.isSafeInteger(now)||now<0)
  throw new Error('STORE_TICKET_REQUEST_INVALID')
 const binding=await establishStoreOperatorBinding(bearerToken,identity)
 let allowed=false
 try{allowed=await deps.validateAttemptForOperator(attemptId,binding.operatorId)}catch{
  throw new Error('STORE_TICKET_ATTEMPT_UNAVAILABLE')
 }
 if(allowed!==true)throw new Error('STORE_TICKET_ATTEMPT_DENIED')
 const operatorId=await revalidateStoreOperatorBinding(binding,bearerToken,identity)
 const request:StoreTicketIssueRequest=Object.freeze({
  attemptId,operatorId,
  ticket:randomBytes(32).toString('hex'),
  expiresAt:new Date(now+30_000).toISOString(),
 })
 try{await deps.issueTicket(request)}catch{throw new Error('STORE_TICKET_ISSUER_UNAVAILABLE')}
 return Object.freeze({...request,binding})
}
