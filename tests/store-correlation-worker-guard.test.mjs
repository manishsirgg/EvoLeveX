import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runStoreCorrelationWorkerGuarded} from '../src/lib/store-correlation-worker-guard.ts'
test('worker defaults off before any dependency access',async()=>{
 let called=false
 const deps={authenticateOperator:async()=>{called=true;throw new Error('must not execute')}}
 for(const options of [{},{enabled:'TRUE',runtime:'isolated-worker'},{enabled:'true',runtime:'nextjs'},{enabled:'false',runtime:'isolated-worker'}]){
  await assert.rejects(runStoreCorrelationWorkerGuarded('a1000000-0000-4000-8000-000000000001',deps,options),/WORKER_DISABLED/)
 }
 assert.equal(called,false)
})
test('guard is not an HTTP route or privileged credential bridge',async()=>{
 const source=await readFile(new URL('../src/lib/store-correlation-worker-guard.ts',import.meta.url),'utf8')
 assert.doesNotMatch(source,/process\.env|createServiceRoleClient|DATABASE_URL|fetch\(|export (?:async )?function (?:GET|POST)/)
 assert.match(source,/options\.enabled!=='true'/)
 assert.match(source,/options\.runtime!=='isolated-worker'/)
})
