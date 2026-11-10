import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('restricted POD quote adapter has no app connection or privilege grants',async()=>{
 const code=await read('src/lib/printful/pod-restricted-quote-writer.ts')
 for(const value of [
  "import 'server-only'",
  "const ROLE='evo_store_pod_quote_writer'",
  "validateTrustedPodQuoteEvidence(evidence,nowMs)",
  "BEGIN ISOLATION LEVEL SERIALIZABLE",
  "SELECT current_user AS principal, session_user AS login",
  "identity.rows[0].principal!==ROLE",
  "identity.rows[0].login!==ROLE",
  "INSERT INTO private.evo_store_pod_quote_snapshots",
  "INSERT INTO private.evo_store_pod_quote_lines",
  "SET CONSTRAINTS ALL IMMEDIATE",
  "await session.query('COMMIT')",
  "await session.query('ROLLBACK')",
 ])assert.ok(code.includes(value),value)
 assert.ok(code.indexOf("validateTrustedPodQuoteEvidence(evidence,nowMs)")<code.indexOf("BEGIN ISOLATION LEVEL SERIALIZABLE"))
 assert.ok(code.indexOf("identity.rows[0].login!==ROLE")<code.indexOf("INSERT INTO private.evo_store_pod_quote_snapshots"))
 assert.ok(code.indexOf("SET CONSTRAINTS ALL IMMEDIATE")<code.indexOf("await session.query('COMMIT')"))
 assert.doesNotMatch(code,/createClient\(|createAdminClient\(|new Client\(|create_razorpay|\/orders\b|fetch\(|grant\s+|process\.env/i)
})
test('trusted POD quote evidence requires strict identity, money, timestamps and line consistency',async()=>{
 const code=await read('src/lib/printful/pod-restricted-quote-contract.ts')
 for(const value of [
  "validateTrustedPodQuoteEvidence(",
  "typeof evidence.destinationDigest!=='string'",
  "observed>nowMs||nowMs-observed>120000",
  "expiry<=nowMs||expiry>nowMs+15*60*1000",
  "evidence.lines.length<1||evidence.lines.length>50",
  "line.quantity<1||line.quantity>10",
  "seen.has(id)",
  "totalQty>50",
  "sum!==subtotal",
  "BigInt(line.quantity)",
 ])assert.ok(code.includes(value),value)
 assert.doesNotMatch(code,/fetch\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|process\.env/i)
})
