import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('real pg composition stays server-only and requires CA-backed TLS',async()=>{
 const source=await readFile(new URL('../src/lib/store-staging-node-pg-role-lookup.ts',import.meta.url),'utf8')
 assert.match(source,/import 'server-only'/)
 assert.match(source,/new pg\.Client\(/)
 assert.match(source,/ssl:\{rejectUnauthorized:true,ca:config\.ca\}/)
 assert.match(source,/createStagingPgLifecycleFactory/)
 assert.match(source,/createStagingRestrictedPgTransport/)
 assert.match(source,/createStagingStoreRestrictedFunctionRoleLookup/)
 assert.doesNotMatch(source,/process\.env|NEXT_PUBLIC_|createServerClient|createServiceRole/)
 assert.doesNotMatch(source,/export (?:const|async function) (?:GET|POST)/)
})
