import test from 'node:test'
import assert from 'node:assert/strict'
import {assertStoreWorkerAdmission} from '../src/lib/store-worker-admission.ts'
const staging={enabled:'true',runtime:'isolated-worker',environment:'staging',storeBridgeEnabled:'false',paymentCaptureEnabled:'false',printfulFulfillmentEnabled:'false',credentialSource:'dedicated-secret-manager',workerIdentity:'evo-store-staging-worker'}
test('accepts explicitly isolated, staging-only and payment-disabled config',()=>assert.doesNotThrow(()=>assertStoreWorkerAdmission(staging)))
test('rejects absent, production and open payment gates',()=>{
 for(const config of [{}, {...staging,environment:'production'},{...staging,storeBridgeEnabled:'true'},{...staging,paymentCaptureEnabled:'true'},{...staging,printfulFulfillmentEnabled:'true'},{...staging,credentialSource:'vercel-env'},{...staging,workerIdentity:' '},{...staging,enabled:'TRUE'}]){
  assert.throws(()=>assertStoreWorkerAdmission(config),/STORE_WORKER_ADMISSION_/)
 }
})
