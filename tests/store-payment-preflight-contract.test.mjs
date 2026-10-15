import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20261015100000_store_payment_preflight.sql',import.meta.url),'utf8')
test('Store Razorpay preflight enforces hold-first locks, buyer ownership, expiry and snapshots',()=>{
 for(const text of [
   'auth.uid()','h.user_id=buyer FOR UPDATE','o.user_id=buyer FOR UPDATE',
   'STORE_PAYMENT_ORDER_UNAVAILABLE','STORE_PAYMENT_HOLD_CONFLICT',
   'STORE_PAYMENT_SNAPSHOT_CONFLICT','STORE_PAYMENT_CLEARANCE_REVOKED',
   'STORE_PAYMENT_ALREADY_INITIATED','STORE_PAYMENT_ITEMS_CONFLICT',
   'STORE_PAYMENT_AMOUNT_INVALID'
 ])assert.ok(sql.includes(text),text)
 assert.ok(sql.indexOf('h.user_id=buyer FOR UPDATE')<sql.indexOf('o.user_id=buyer FOR UPDATE'))
})
test('Store preflight neither collects payment nor changes orders or stock',()=>{
 assert.match(sql,/'payment_ready',false/)
 assert.match(sql,/'requires_provider_capability_check',true/)
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?(?:public\.(?:payments|orders|evo_store_inventory)|private\.)/i)
 assert.doesNotMatch(sql,/fetchRazorpay|capture|Printful/)
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.preflight_evo_store_payment\(uuid\) TO authenticated/)
})
