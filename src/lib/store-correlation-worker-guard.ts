import {runIsolatedStoreCorrelationProtocol} from './store-isolated-correlation-protocol.ts'
import type {WorkerBoundaryDependencies} from './store-isolated-correlation-protocol.ts'

/**
 * Worker entry foundation. Deliberately requires a locally injected trusted
 * dependency bundle; no HTTP handler, secrets, DB grants, or deployed runner.
 * The switch defaults CLOSED, including when unset or misspelled.
 */
export async function runStoreCorrelationWorkerGuarded(
 attemptId:string,
 dependencies:WorkerBoundaryDependencies,
 options:Readonly<{enabled?:string;runtime?:string}>={},
){
 if(options.enabled!=='true'||options.runtime!=='isolated-worker')
  throw new Error('STORE_CORRELATION_WORKER_DISABLED')
 return runIsolatedStoreCorrelationProtocol(attemptId,dependencies)
}
