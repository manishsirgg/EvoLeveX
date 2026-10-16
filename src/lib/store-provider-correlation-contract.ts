import {toRazorpaySubunits} from './razorpay-money.ts'
import type {StoreProviderOrderEvidence} from './store-razorpay-provider-evidence.ts'

export type TrustedCorrelationInput=Readonly<{
 attemptId:string;orderId:string;intentId:string;receipt:string;
 amount:string;currency:string;operatorId:string;
 provider:StoreProviderOrderEvidence
}>
export type CorrelationResult=Readonly<{
 correlated:true;created:boolean;payment_ready:false;
 attempt_id:string;provider_order_id:string
}>
export type RestrictedCorrelationExecutor=(input:TrustedCorrelationInput)=>Promise<CorrelationResult>
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Pure, fail-closed handoff. Only a separately reviewed privileged service
 * may supply an executor, after authenticated operator authorization,
 * independent Razorpay GET, and immediate revalidation of attempt state.
 * This module grants no database privilege and has no production executor.
 */
export async function recordVerifiedCorrelationViaRestrictedExecutor(
 input:TrustedCorrelationInput,
 execute:RestrictedCorrelationExecutor,
):Promise<CorrelationResult>{
 if(![input.attemptId,input.orderId,input.intentId,input.operatorId].every(x=>UUID.test(x)))
  throw new Error('STORE_CORRELATION_IDENTITY_INVALID')
 if(!/^evs_[0-9a-f]{32}$/.test(input.receipt)
  ||!/^order_[A-Za-z0-9]{8,64}$/.test(input.provider.id))
  throw new Error('STORE_CORRELATION_EVIDENCE_INVALID')
 if(input.provider.receipt!==input.receipt||input.provider.currency!==input.currency
  ||input.provider.amount!==toRazorpaySubunits(input.amount,input.currency))
  throw new Error('STORE_CORRELATION_EVIDENCE_MISMATCH')
 const result=await execute(input)
 if(result.correlated!==true||result.payment_ready!==false
  ||typeof result.created!=='boolean'
  ||result.attempt_id!==input.attemptId
  ||result.provider_order_id!==input.provider.id)
  throw new Error('STORE_CORRELATION_RESULT_INVALID')
 return result
}
