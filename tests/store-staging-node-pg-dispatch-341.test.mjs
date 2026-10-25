import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('isolated staging node-pg dispatch uses TLS configuration and dedicated claim connection',async()=>{
 const code=await read('src/lib/store-staging-node-pg-dispatch.ts')
 const config=await read('src/lib/store-staging-pg-driver-config.ts')
 assert.ok(code.includes("import {Client} from 'pg'"))
 assert.ok(code.includes('createStoreStagingPgClientConfig(secrets)'))
 assert.ok(code.includes('parsed.username!==expectedLoginRole'))
 assert.ok(code.includes('claimStagingStoreDispatchWithDedicatedPgClient('))
 assert.ok(code.includes('const client=new Client(settings)'))
 assert.ok(code.includes('params?[...params]:[]'))
 assert.ok(code.includes('end:()=>client.end()'))
 assert.ok(config.includes('rejectUnauthorized:true as const'))
 assert.doesNotMatch(code,/fetch\(|createRazorpayOrder\(|service_role|process\.env\.|NEXT_PUBLIC_/)
})
