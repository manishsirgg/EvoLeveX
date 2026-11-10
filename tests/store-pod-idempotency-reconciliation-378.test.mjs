import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('POD idempotency compares full trusted quote evidence, not only key or amounts',async()=>{
 const code=await read('src/lib/printful/pod-quote-idempotency-reconciliation.ts')
 for(const marker of [
  "validateTrustedPodQuoteEvidence(incoming,nowMs)",
  "incoming.idempotencyKey.toLowerCase()",
  "incoming.customerId.toLowerCase()",
  "providerShippingOption:input.providerShippingOption",
  "providerQuoteObservedAt:observed,expiresAt:expires,lines",
  "destinationDigest:input.destinationDigest",
  "catalogVariantId:v.catalogVariantId",
  "unitPrice:normalizeAmount(v.unitPrice)",
  "sort((a,b)=>a.variantId.localeCompare(b.variantId))",
  "existing.status!=='prepared'",
  "Date.parse(existing.expires_at)<=nowMs",
  "timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'))",
  "status:'CONFLICT'",
  "status:'MATCH'",
  "status:'ABSENT'",
 ])assert.ok(code.includes(marker),marker)
 assert.doesNotMatch(code,/fetch\(|INSERT INTO|UPDATE\s+private|DELETE FROM|\.rpc\(|razorpay|\/orders\b/i)
})

test('POD idempotency inspector requires dedicated login and scopes reads by owner/key',async()=>{
 const code=await read('src/lib/printful/pod-quote-idempotency-inspection.ts')
 for(const marker of [
  "import 'server-only'",
  "const ROLE='evo_store_pod_quote_writer'",
  "SELECT current_user AS principal, session_user AS login",
  "identity.rows[0].principal!==ROLE",
  "identity.rows[0].login!==ROLE",
  "WHERE customer_id=$1::uuid AND idempotency_key=$2::uuid",
  "WHERE quote_id=$1::uuid",
  "reconcilePodQuoteReplay(incoming,existing",
  "return {status:'UNAVAILABLE'}",
 ])assert.ok(code.includes(marker),marker)
 assert.ok(code.indexOf("identity.rows[0].login!==ROLE")<code.indexOf("FROM private.evo_store_pod_quote_snapshots"))
 assert.doesNotMatch(code,/createClient\(|new Client\(|INSERT INTO|UPDATE\s+private|DELETE FROM|\.rpc\(|fetch\(|process\.env/i)
})
