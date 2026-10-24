import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('staging PG adapter refuses generic elevated identities and keeps trust verification',async()=>{
 const source=await readFile(new URL('../src/lib/store-staging-node-pg-role-lookup.ts',import.meta.url),'utf8')
 assert.match(source,/import 'server-only'/)
 assert.match(source,/ROLE\.test\(config\.user\)/)
 assert.match(source,/evo_store_role_reader_login/)
 assert.match(source,/HOSTNAME\.test\(config\.host\)/)
 assert.match(source,/PEM\.test\(config\.ca\)/)
 assert.match(source,/rejectUnauthorized:true,ca:config\.ca/)
 assert.match(source,/connectionTimeoutMillis:settings\.connectionTimeoutMillis/)
 assert.match(source,/statement_timeout:settings\.statement_timeout/)
 assert.match(source,/query_timeout:settings\.query_timeout/)
 assert.doesNotMatch(source,/process\.env|NEXT_PUBLIC_|ssl:\s*false|rejectUnauthorized:false/)
})
