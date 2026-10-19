import type {KeyObject} from 'node:crypto'
import {issueBoundStoreOperatorTicket,type StoreTicketIssueRequest} from './store-worker-ticket-issuance.ts'
import {admitBoundStoreCorrelationTransaction} from './store-bound-correlation-transaction-admission.ts'
import type {WorkerIdentityDependencies} from './store-worker-operator-identity.ts'
import type {SignedStoreCorrelationProof} from './store-correlation-signed-proof.ts'
import type {TrustedCorrelationInput,CorrelationResult} from './store-provider-correlation-contract.ts'

/**
 * Staging-only complete contract exercise, NOT a live worker or SQL grant.
 * The injected transaction MUST eventually verify and consume the ticket
 * alongside the actual correlation in one database transaction; neither an
 * application callback nor this composition independently proves that.
 */
export async function stageStoreTicketBoundCorrelation(
 proof:SignedStoreCorrelationProof,
 trusted:TrustedCorrelationInput,
 nonce:string,
 publicKey:KeyObject,
 bearerToken:string,
 identity:WorkerIdentityDependencies,
 deps:Readonly<{
   validateAttemptForOperator:(attemptId:string,operatorId:string)=>Promise<boolean>
   issueTicket:(request:StoreTicketIssueRequest)=>Promise<void>
   reloadAttempt:()=>Promise<TrustedCorrelationInput>
   consumeTicketAndCommitAtomically:(ticket:string,input:TrustedCorrelationInput,nonce:string,issuedAtMs:number)=>Promise<CorrelationResult>
 }>,
 now=Date.now(),
):Promise<CorrelationResult>{
 const issued=await issueBoundStoreOperatorTicket(
   bearerToken,trusted.attemptId,identity,{
     validateAttemptForOperator:deps.validateAttemptForOperator,
     issueTicket:deps.issueTicket,
   },now)
 if(issued.operatorId!==trusted.operatorId||issued.attemptId!==trusted.attemptId)
  throw new Error('STORE_TICKET_TRANSACTION_IDENTITY_MISMATCH')
 return admitBoundStoreCorrelationTransaction(proof,trusted,nonce,publicKey,
   issued.binding,bearerToken,identity,{
    reloadAttempt:deps.reloadAttempt,
    commitAtomically:(input,n,issuedAtMs)=>deps.consumeTicketAndCommitAtomically(
      issued.ticket,input,n,issuedAtMs),
   },now)
}
