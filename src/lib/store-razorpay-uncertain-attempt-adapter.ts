import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { parseTrustedStoreAmount } from '@/lib/store-provider-amount'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RECEIPT=/^evs_[0-9a-f]{32}$/
const CURRENCIES=new Set(['USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY'])

export type TrustedUncertainStoreAttempt=Readonly<{
 attemptId:string;intentId:string;orderId:string;receipt:string;
 amount:string;currency:string;
 state:'dispatch_uncertain'|'reconciliation_required'
}>

/** Operator's JWT is retained across the authorization and audited RPC. */
export async function loadAuthorizedUncertainStoreAttempt(attemptId:string):Promise<TrustedUncertainStoreAttempt>{
 if(!UUID.test(attemptId)) throw new Error('STORE_PROVIDER_ATTEMPT_INVALID')
 const supabase=await createClient()
 const {data:userResult,error:userError}=await supabase.auth.getUser()
 if(userError||!userResult.user) throw new Error('STORE_PROVIDER_OPERATOR_UNAUTHORIZED')
 const {data:eligible,error:eligibilityError}=await supabase.rpc('can_operate_evo_store_reconciliation')
 if(eligibilityError||eligible!==true) throw new Error('STORE_PROVIDER_OPERATOR_UNAUTHORIZED')
 const {data,error}=await supabase.rpc('read_evo_store_uncertain_attempt_for_reconciliation',{p_attempt_id:attemptId})
 if(error||!data||typeof data!=='object'||Array.isArray(data)) throw new Error('STORE_PROVIDER_UNCERTAIN_READ_FAILED')
 const v=data as Record<string,unknown>
 if(v.attempt_id!==attemptId||typeof v.intent_id!=='string'||!UUID.test(v.intent_id)
 ||typeof v.order_id!=='string'||!UUID.test(v.order_id)
 ||typeof v.receipt!=='string'||!RECEIPT.test(v.receipt)
 ||typeof v.currency!=='string'||!CURRENCIES.has(v.currency)
 ||(v.state!=='dispatch_uncertain'&&v.state!=='reconciliation_required')
 ||v.provider_order_id!==null||v.payment_ready!==false)
   throw new Error('STORE_PROVIDER_UNCERTAIN_ATTEMPT_INVALID')
 const amount=parseTrustedStoreAmount(v.amount,v.currency)
 return {attemptId,intentId:v.intent_id,orderId:v.order_id,receipt:v.receipt,amount,currency:v.currency,state:v.state}
}
