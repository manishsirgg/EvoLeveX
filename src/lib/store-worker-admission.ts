/**
 * Configuration admission for a future dedicated Store correlation worker.
 * Values must be sourced from the worker's own secret manager, never from an
 * incoming request. Passing this check DOES NOT establish authentication,
 * network isolation or permission to execute PostgreSQL correlation.
 */
export type WorkerAdmissionConfig=Readonly<{
  enabled?:string
  runtime?:string
  environment?:string
  storeBridgeEnabled?:string
  paymentCaptureEnabled?:string
  printfulFulfillmentEnabled?:string
  credentialSource?:string
  workerIdentity?:string
}>
const IDENTIFIER=/^[a-z][a-z0-9-]{2,63}$/
export function assertStoreWorkerAdmission(config:WorkerAdmissionConfig):void {
  if(config.enabled!=='true'||config.runtime!=='isolated-worker')
    throw new Error('STORE_WORKER_ADMISSION_DISABLED')
  if(config.environment!=='staging')
    throw new Error('STORE_WORKER_ADMISSION_ENVIRONMENT_DENIED')
  if(config.storeBridgeEnabled!=='false'
    ||config.paymentCaptureEnabled!=='false'
    ||config.printfulFulfillmentEnabled!=='false')
    throw new Error('STORE_WORKER_ADMISSION_PAYMENT_GATES_OPEN')
  if(config.credentialSource!=='dedicated-secret-manager'
    ||typeof config.workerIdentity!=='string'
    ||!IDENTIFIER.test(config.workerIdentity))
    throw new Error('STORE_WORKER_ADMISSION_IDENTITY_UNTRUSTED')
}
