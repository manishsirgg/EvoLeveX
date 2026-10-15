import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261015110000_store_razorpay_intent_claim.sql',import.meta.url),'utf8')
test('Store intent is one per order and idempotent per buyer key',()=>{
 for(const s of ['order_id uuid PRIMARY KEY','intent_id uuid NOT NULL UNIQUE',
   'UNIQUE(user_id,idempotency_key)','WHERE c.order_id=p_order_id FOR UPDATE',
   'STORE_INTENT_CONFLICT','existing.idempotency_key IS DISTINCT FROM p_idempotency_key',
   'public.preflight_evo_store_payment(p_order_id)']) assert.ok(sql.includes(s),s)
})
test('Store intent does not permit merchant payment, provider submission or inventory mutation',()=>{
 const executable=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n')
 for(const s of ["'provider_order_created',false","'payment_ready',false",
    'REVOKE ALL ON FUNCTION','TO authenticated']) assert.ok(sql.includes(s),s)
 assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?public\.(?:payments|orders|evo_store_inventory)/i)
 assert.doesNotMatch(executable,/fetchRazorpayPayment|createRazorpayOrder|fulfill_confirmed_evo_vault_order|Printful/i)
})
