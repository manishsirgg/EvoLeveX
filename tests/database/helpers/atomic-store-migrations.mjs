import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sha256 } from './baseline.mjs'

export const ATOMIC_STORE_MIGRATIONS = [
  ['20261005040000_evo_store_inventory_management_support.sql', '718b4eff2b069e0448b7759bfa9be6744e40fa6e2794691794a310f072dff8bc'],
  ['20261006000000_evo_store_checkout_reservation_foundation.sql', 'bb80c33b930dd7c436132e7bf5d3c739dd095e3643cd15b140662e1144cb0b5a'],
  ['20261006010000_evo_store_transactional_inventory_reservations.sql', 'd69712ebf5c3f2617c1e1857aa455d6ffb0d1b9630a64eba3bc64921a3bd9157'],
  ['20261008125840_evo_store_checkout_expiry_worker.sql', '37a1cd895f206c704fd29399be514b26a64ea11909743c92390074ba49ee166c'],
  ['20261009000000_evo_store_archived_inventory_guard_compatibility.sql', 'e402ba961106d1c489b7d02537a7ba28fcc41686aea4c030e6f319416ad3f04b'],
]

export async function readAtomicStoreMigrations() {
  return Promise.all(ATOMIC_STORE_MIGRATIONS.map(async ([name, checksum]) => {
    const bytes = await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url))
    assert.equal(sha256(bytes), checksum, `Unchanged reviewed migration: ${name}`)
    return bytes.toString('utf8')
  }))
}

export function atomicStoreTransaction(migrations, failureAfter = null) {
  // ON_ERROR_STOP is enforced by the canonical disposable psql wrapper.
  const statements = ['BEGIN;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '60s';"]
  migrations.forEach((sql, index) => {
    statements.push(sql)
    if (failureAfter === index + 1) statements.push("DO $$ BEGIN RAISE EXCEPTION 'ATOMIC_STORE_TEST_FAILURE'; END $$;")
  })
  statements.push('COMMIT;')
  return statements.join('\n')
}
