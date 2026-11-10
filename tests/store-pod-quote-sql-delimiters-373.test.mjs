import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('deployed quote integrity migration has correctly paired PL/pgSQL dollar quotes',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261109210000_store_pod_quote_integrity.sql',import.meta.url),'utf8')
 assert.equal((sql.match(/\bas \$\$/g)??[]).length,2)
 assert.equal((sql.match(/^\$\$;/gm)??[]).length,2)
 assert.ok(sql.includes('create constraint trigger evo_store_pod_quote_header_integrity'))
 assert.ok(sql.includes('create constraint trigger evo_store_pod_quote_line_integrity'))
 assert.ok(sql.includes('create trigger evo_store_pod_quote_header_immutability'))
 assert.ok(sql.includes('create trigger evo_store_pod_quote_line_immutability'))
 assert.doesNotMatch(sql,/\bas \$\n|^\$;/m)
 assert.doesNotMatch(sql,/\bgrant\s+(?:all|insert|update|delete|execute)\b/i)
})
