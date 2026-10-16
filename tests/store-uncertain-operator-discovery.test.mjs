import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const adapter=await readFile(new URL('../src/lib/store-razorpay-uncertain-attempt-adapter.ts',import.meta.url),'utf8')
const orchestration=await readFile(new URL('../src/lib/store-razorpay-uncertain-operator-discovery.ts',import.meta.url),'utf8')

test('uncertain read requires authenticated operator, eligibility, and audited RPC',()=>{
 assert.match(adapter,/import 'server-only'/)
 assert.match(adapter,/supabase\.auth\.getUser\(\)/)
 assert.match(adapter,/can_operate_evo_store_reconciliation/)
 assert.match(adapter,/read_evo_store_uncertain_attempt_for_reconciliation/)
 assert.ok(adapter.indexOf('supabase.auth.getUser()')<adapter.indexOf('read_evo_store_uncertain_attempt_for_reconciliation'))
 assert.match(adapter,/parseTrustedStoreAmount\(v\.amount,v\.currency\)/)
 assert.match(adapter,/v\.provider_order_id!==null/)
 assert.match(adapter,/v\.payment_ready!==false/)
})
test('operator discovery uses persisted expectations and is not payment authorization',()=>{
 assert.match(orchestration,/import 'server-only'/)
 assert.match(orchestration,/loadAuthorizedUncertainStoreAttempt/)
 assert.match(orchestration,/fetchUniqueStoreOrderByTrustedReceipt/)
 assert.ok(orchestration.indexOf('loadAttempt??loadAuthorizedUncertainStoreAttempt')<
   orchestration.indexOf('discover??fetchUniqueStoreOrderByTrustedReceipt'))
 assert.match(orchestration,/paymentReady:false,correlationAuthorized:false/)
 assert.doesNotMatch(orchestration,/\.rpc\(|\.insert\(|\.update\(|createServiceRoleClient|export (?:async )?function (?:GET|POST)/)
})
