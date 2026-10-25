import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const source=()=>readFile(new URL('../scripts/store-staging-worker-readiness.mjs',import.meta.url),'utf8')
test('readiness probe is strictly staging-only and read-only',async()=>{
 const s=await source()
 for(const guard of ["STORE_WORKER_ENVIRONMENT!=='staging'","STORE_WORKER_RUNTIME!=='isolated-worker'",
  "STORE_WORKER_PAYMENT_CAPTURE_ENABLED!=='false'","STORE_WORKER_PRINTFUL_ENABLED!=='false'",
  "STORE_RESERVATION_BRIDGE_ENABLED!=='false'","rejectUnauthorized:true",
  "has_function_privilege(current_user","current_user AS principal","session_user AS login",
  "result.rows[0].can_claim!==true","await client.end()"])assert.ok(s.includes(guard),guard)
 assert.doesNotMatch(s,/\b(UPDATE|INSERT|DELETE|CALL)\s+private\.|createRazorpayOrder\(|claim_evo_store_provider_dispatch\(\$1|https:\/\/api\.razorpay\.com|PRINTFUL_API_KEY/)
})
