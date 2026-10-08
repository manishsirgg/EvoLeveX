import 'server-only'

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

export const EXPIRY_BATCH_SIZE = 25
export const EXPIRY_MAX_CALLS = 3
export const EXPIRY_WORK_BUDGET_MS = 20_000
export const EXPIRY_RPC_BUDGET_MS = 5_000

export type ExpiryCounts = {
  examined: number
  claimed: number
  expired: number
  busy: number
  reconciliation_failed: number
  scan_limit_reached: boolean
  batch_limit_reached: boolean
}

type RpcReply = { data: unknown; error: unknown; status?: number }
export type ExpiryRpc = (signal: AbortSignal) => PromiseLike<RpcReply>
type Classification = 'SUCCESS' | 'DEGRADED' | 'FAILED'
type ErrorCategory = 'unauthorized' | 'configuration' | 'rpc_transport' | 'rpc_error'
  | 'invalid_response' | 'deadline' | 'reconciliation' | 'contention' | null
type StopReason = 'unauthorized' | 'failed' | 'deadline' | 'no_progress' | 'partial_batch' | 'call_limit'
export type ExpiryReport = {
  invocation_id: string
  duration_ms: number
  rpc_calls: number
  totals: ExpiryCounts
  classification: Classification
  error_category: ErrorCategory
  stop_reason: StopReason
}

type Dependencies = {
  secret: () => string | undefined
  // Created only after cron authorization. Each call is a separate POST RPC
  // transaction; callers must not provide a shared explicit DB transaction.
  createRpc: () => ExpiryRpc
  now?: () => number
  invocationId?: () => string
  log?: (report: ExpiryReport) => void
}

function emptyCounts(): ExpiryCounts {
  return { examined: 0, claimed: 0, expired: 0, busy: 0, reconciliation_failed: 0,
    scan_limit_reached: false, batch_limit_reached: false }
}

export function isCronAuthorized(request: Request, secret: string | undefined): boolean {
  const header = request.headers.get('authorization')
  if (typeof secret !== 'string' || !secret || !/^[^\s,]+$/.test(secret) || !header) return false
  const match = /^Bearer ([^\s,]+)$/.exec(header)
  if (!match) return false
  // Hash both tokens to equal-sized buffers; the secret comparison itself never
  // uses length-dependent equality and no token material enters diagnostics.
  return timingSafeEqual(createHash('sha256').update(match[1]).digest(),
    createHash('sha256').update(secret).digest())
}

export function validateExpiryCounts(value: unknown): ExpiryCounts | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const expected = Object.keys(emptyCounts())
  if (Object.keys(row).length !== expected.length || expected.some(key => !Object.hasOwn(row, key))) return null
  for (const key of ['examined', 'claimed', 'expired', 'busy', 'reconciliation_failed']) {
    const maximum = key === 'examined' || key === 'busy' ? 100 : EXPIRY_BATCH_SIZE
    if (typeof row[key] !== 'number' || !Number.isInteger(row[key]) || row[key] < 0 || row[key] > maximum) return null
  }
  if (row.examined !== (row.claimed as number) + (row.busy as number)
    || row.claimed !== (row.expired as number) + (row.reconciliation_failed as number)
    || row.scan_limit_reached !== (row.examined === 100)
    || row.batch_limit_reached !== (row.claimed === EXPIRY_BATCH_SIZE)) return null
  // Return an explicit allowlist, never the untrusted object itself.
  return { examined: row.examined as number, claimed: row.claimed as number,
    expired: row.expired as number, busy: row.busy as number,
    reconciliation_failed: row.reconciliation_failed as number,
    scan_limit_reached: row.scan_limit_reached as boolean,
    batch_limit_reached: row.batch_limit_reached as boolean }
}

function operationalLog(report: ExpiryReport) {
  if (report.classification === 'FAILED') console.error('Store checkout expiry', report)
  else if (report.classification === 'DEGRADED') console.warn('Store checkout expiry', report)
  else console.info('Store checkout expiry', report)
}

export function createStoreCheckoutExpiryHandler(dependencies: Dependencies) {
  return async function GET(request: Request): Promise<Response> {
    const now = dependencies.now ?? (() => performance.now())
    const started = now()
    const invocationId = (dependencies.invocationId ?? randomUUID)()
    const totals = emptyCounts()
    let calls = 0
    const finish = (classification: Classification, category: ErrorCategory, stop: StopReason, status = 200) => {
      const report: ExpiryReport = { invocation_id: invocationId,
        duration_ms: Math.max(0, Math.round(now() - started)), rpc_calls: calls,
        totals, classification, error_category: category, stop_reason: stop }
      // Only our constructed report is logged. Never a caught exception/RPC error.
      ;(dependencies.log ?? operationalLog)(report)
      return Response.json({ ok: classification !== 'FAILED', ...report }, {
        status, headers: { 'Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' },
      })
    }

    if (!isCronAuthorized(request, dependencies.secret())) return finish('FAILED', 'unauthorized', 'unauthorized', 401)
    let rpc: ExpiryRpc
    try { rpc = dependencies.createRpc() }
    catch { return finish('FAILED', 'configuration', 'failed', 503) }

    let stop: StopReason = 'call_limit'
    for (let index = 0; index < EXPIRY_MAX_CALLS; index += 1) {
      if (EXPIRY_WORK_BUDGET_MS - (now() - started) < EXPIRY_RPC_BUDGET_MS) {
        stop = 'deadline'
        break
      }
      // This bounds HTTP waiting, NOT PostgreSQL execution or rollback. A lost
      // response may represent a committed batch; never retry it in this run.
      const signal = AbortSignal.timeout(EXPIRY_RPC_BUDGET_MS)
      let reply: RpcReply
      calls += 1
      try { reply = await rpc(signal) }
      catch { return finish('FAILED', 'rpc_transport', 'failed', 503) }
      if (!reply || typeof reply !== 'object') return finish('FAILED', 'invalid_response', 'failed', 503)
      if (reply.error) return finish('FAILED', reply.status === 0 ? 'rpc_transport' : 'rpc_error', 'failed', 503)
      const counts = validateExpiryCounts(reply.data)
      if (!counts) return finish('FAILED', 'invalid_response', 'failed', 503)
      for (const key of ['examined', 'claimed', 'expired', 'busy', 'reconciliation_failed'] as const) totals[key] += counts[key]
      totals.scan_limit_reached ||= counts.scan_limit_reached
      totals.batch_limit_reached ||= counts.batch_limit_reached
      if (now() - started >= EXPIRY_WORK_BUDGET_MS) { stop = 'deadline'; break }
      if (counts.expired === 0) { stop = 'no_progress'; break }
      if (!counts.batch_limit_reached) { stop = 'partial_batch'; break }
    }
    const category: ErrorCategory = totals.reconciliation_failed > 0 ? 'reconciliation'
      : totals.busy > 0 ? 'contention' : stop === 'deadline' ? 'deadline' : null
    return finish(category ? 'DEGRADED' : 'SUCCESS', category, stop)
  }
}
