import {toRazorpaySubunits} from './razorpay-money.ts'
import type {StoreProviderOrderEvidence} from './store-razorpay-provider-evidence.ts'

export type RecoveryExpectation = Readonly<{attemptId:string;orderId:string;intentId:string;receipt:string;amount:string;currency:string;state:string}>

/** Pure verification boundary; does not persist payment or correlation. */
export function checkIndependentRecoveryEvidence(
 expected:RecoveryExpectation,
 discovered:StoreProviderOrderEvidence,
 verified:StoreProviderOrderEvidence,
):void{
 if(!['dispatch_uncertain','reconciliation_required'].includes(expected.state))
   throw new Error('STORE_RECOVERY_STATE_INVALID')
 if(!/^order_[A-Za-z0-9]{8,64}$/.test(discovered.id))
   throw new Error('STORE_RECOVERY_ORDER_ID_INVALID')
 const amount=toRazorpaySubunits(expected.amount,expected.currency)
 if(discovered.id!==verified.id||verified.receipt!==expected.receipt
  ||discovered.receipt!==verified.receipt||verified.currency!==expected.currency
  ||discovered.currency!==verified.currency||verified.amount!==amount
  ||discovered.amount!==verified.amount)
   throw new Error('STORE_RECOVERY_EVIDENCE_MISMATCH')
}
