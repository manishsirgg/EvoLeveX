import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sha256 } from './baseline.mjs'
import { ATOMIC_STORE_MIGRATIONS, readAtomicStoreMigrations } from './atomic-store-migrations.mjs'

// Deployment substitutes this successor for D; it does NOT append it after D.
export const COMPATIBLE_GUARD_MIGRATION = ['20261009010000_evo_store_archived_inventory_guard_crlf_compatibility.sql', 'cdd3fd3604b40c527eb14e4d8c600dffec36161fb4b25a8747261123b70863d7']
export const COMPATIBLE_STORE_MIGRATIONS = [...ATOMIC_STORE_MIGRATIONS.slice(0, 4), COMPATIBLE_GUARD_MIGRATION]
export async function readCompatibleStoreMigrations() {
  const originals = await readAtomicStoreMigrations() // pins all five unchanged originals
  const [name, checksum] = COMPATIBLE_GUARD_MIGRATION
  const bytes = await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url))
  assert.equal(sha256(bytes), checksum, `Reviewed compatibility successor: ${name}`)
  return [...originals.slice(0, 4), bytes.toString('utf8')]
}
