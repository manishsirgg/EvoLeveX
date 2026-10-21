import test from 'node:test'
import assert from 'node:assert/strict'
import {createStoreStagingPgClientConfig} from '../src/lib/store-staging-pg-driver-config.ts'

const valid={
 connectionString:'postgresql://readonly:disposable@database.example.test:5432/postgres',
 caCertificate:'-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----',
}
test('requires verified TLS and bounded connection/query settings',()=>{
 const config=createStoreStagingPgClientConfig(valid)
 assert.equal(config.ssl.rejectUnauthorized,true)
 assert.equal(config.ssl.ca,valid.caCertificate)
 assert.equal(config.connectionTimeoutMillis,3000)
 assert.equal(config.query_timeout,3000)
 assert.equal(config.statement_timeout,3000)
})
test('rejects unsafe and ambiguous database URI parameters',()=>{
 for(const suffix of ['?sslmode=disable','?sslmode=no-verify','?sslcert=/tmp/cert','?sslrootcert=/tmp/ca','?sslkey=/tmp/key']){
  assert.throws(()=>createStoreStagingPgClientConfig({...valid,connectionString:valid.connectionString+suffix}),/CONFIG_INVALID/)
 }
 for(const uri of ['https://example.test','postgresql://reader@db.example.test/db','postgresql://reader:secret@db.example.test/']){
  assert.throws(()=>createStoreStagingPgClientConfig({...valid,connectionString:uri}),/CONFIG_INVALID/)
 }
})
test('requires explicitly supplied CA certificate and excludes secrets from failures',()=>{
 const secret='supersecret'
 assert.throws(()=>createStoreStagingPgClientConfig({...valid,caCertificate:''}),e=>e.message==='STORE_PG_CA_REQUIRED'&&!e.message.includes(secret))
 assert.throws(()=>createStoreStagingPgClientConfig({...valid,connectionString:'not a url '+secret}),e=>!e.message.includes(secret))
})
