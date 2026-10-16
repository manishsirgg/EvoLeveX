import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const plan=await readFile(new URL('../docs/store/restricted-correlation-execution-architecture.md',import.meta.url),'utf8')
test('isolated correlation design keeps all untrusted execution paths closed',()=>{
 for(const required of ['auth.getUser()','Orders GET','payment_ready=false','separate approval','PG15/PG17','rejected','nonce','revocation','service_role','request.jwt.claim.sub']){
   assert.ok(plan.includes(required),required)
 }
 assert.match(plan,/not an implemented privileged adapter/)
 assert.match(plan,/Never grant EXECUTE/)
})
