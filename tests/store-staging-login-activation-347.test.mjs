import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('manual staging login activation fails closed before changing LOGIN',async()=>{
 const sql=await readFile(new URL('../docs/store/sql/staging-dispatch-login-activation-347.sql',import.meta.url),'utf8')
 for(const token of ["evo.store_staging_login_approved","evo.store_environment","rolcanlogin","rolsuper","rolcreaterole","rolbypassrls","rolinherit","pg_catalog.pg_authid","rolpassword LIKE 'SCRAM-SHA-256$%'","has_function_privilege","has_table_privilege","ALTER ROLE evo_store_staging_claim_worker LOGIN"])assert.ok(sql.includes(token),token)
 assert.ok(sql.indexOf("rolpassword LIKE 'SCRAM-SHA-256$%'")<sql.indexOf('ALTER ROLE evo_store_staging_claim_worker LOGIN'))
 assert.doesNotMatch(sql,/PASSWORD\s+'|CREATE ROLE|GRANT EXECUTE|https:\/\/api\.razorpay\.com/i)
})
