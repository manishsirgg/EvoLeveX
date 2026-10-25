import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('gated store quote endpoint is owner-scoped, nonpayable and does not finalize orders',async()=>{
 const route=await read('src/app/api/store/checkout/quote/route.ts')
 const migration=await read('supabase/migrations/20261014070000_store_global_quote_snapshot.sql')
 for(const token of ["STORE_V1_RESERVATION_UI_ENABLED!=='true'","STORE_RESERVATION_BRIDGE_ENABLED!=='true'","isSameOrigin(request)","supabase.auth.getUser()","rpc('snapshot_evo_store_global_quote'","quote_payable:false","Cache-Control"])assert.ok(route.includes(token),token)
 assert.match(migration,/FUNCTION public\.snapshot_evo_store_global_quote\(p_checkout_id uuid\)/)
 assert.doesNotMatch(route,/finalize_evo_store_merchant_order|create_pending_evo_store_order|reserve_razorpay_payment|createRazorpayOrder|service_role/)
})
test('checkout displays only nonpayable quote details, not a checkout charge',async()=>{
 const review=await read('src/components/store/store-checkout-review.tsx')
 assert.ok(review.includes('/api/store/checkout/quote'))
 assert.ok(review.includes('q.quote_payable===false'))
 assert.ok(review.includes('No final payable total is available'))
 assert.match(review,/<button type="button" disabled/)
 assert.doesNotMatch(review,/razorpay\.open|finalize_evo_store_merchant_order/)
})
