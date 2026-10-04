import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export const EXPECTED_BASELINE_SHA256 = '3c41378ec2a24e6c51fb2328904a0366915de139bb3e24009596637fea28e770'
export const BASELINE_URL = new URL('../supabase/migrations/00000000000000_effective_schema.sql', import.meta.url)

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function readVerifiedBaseline() {
  const bytes = await readFile(BASELINE_URL)
  const actual = sha256(bytes)
  if (actual !== EXPECTED_BASELINE_SHA256) {
    throw new Error(`Effective schema SHA-256 mismatch: expected ${EXPECTED_BASELINE_SHA256}, received ${actual}`)
  }
  return bytes.toString('utf8')
}

export function makePostgres15Compatible(sql, serverVersion) {
  if (!Number.isInteger(serverVersion) || serverVersion < 120000) {
    throw new Error('Unsupported PostgreSQL server version')
  }
  if (serverVersion >= 170000) return sql
  // PostgreSQL 17 introduced MAINTAIN. Remove only that ACL token from the
  // ephemeral input stream; the authoritative baseline remains byte-identical.
  return sql
    .replaceAll(',MAINTAIN', '')
    .replaceAll('MAINTAIN,', '')
    .replaceAll(' GRANT MAINTAIN ON ', ' GRANT SELECT ON ')
}
