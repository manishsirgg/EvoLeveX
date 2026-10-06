import { readFile } from 'node:fs/promises'

import { makePostgres15Compatible, readVerifiedBaseline } from './baseline.mjs'
import { LOCAL_DATABASE_URL, LOCAL_DATABASE, validateDisposableTarget } from './local-target.mjs'
import { run } from './process.mjs'
import { spawnSync } from 'node:child_process'

const databaseRoot = new URL('..', import.meta.url)
const setupUrl = new URL('../supabase/bootstrap/setup.sql', import.meta.url)
const storeCatalogMigrationUrl = new URL('../../../supabase/migrations/20261004000000_evo_store_catalog_foundation.sql', import.meta.url)
const storeManagementMigrationUrl = new URL('../../../supabase/migrations/20261005000000_evo_store_catalog_management_support.sql', import.meta.url)
const storeImageManagementMigrationUrl = new URL('../../../supabase/migrations/20261005010000_evo_store_product_image_management_support.sql', import.meta.url)
const storeVariantManagementMigrationUrl = new URL('../../../supabase/migrations/20261005020000_evo_store_product_variant_management_support.sql', import.meta.url)
const storeVariantPriceManagementMigrationUrl = new URL('../../../supabase/migrations/20261005030000_evo_store_variant_price_management_support.sql', import.meta.url)
const storeInventoryManagementMigrationUrl = new URL('../../../supabase/migrations/20261005040000_evo_store_inventory_management_support.sql', import.meta.url)

function safeEnvironment() {
  const env = { ...process.env, PGCONNECT_TIMEOUT: '3' }
  // psql receives the canonical URL as an argument. Generic/Cloud variables are
  // deleted so libpq cannot use them as an implicit fallback or override.
  for (const key of Object.keys(env)) {
    if (key === 'DATABASE_URL' || key === 'SUPABASE_DB_URL' || key.startsWith('PG')) delete env[key]
  }
  env.PGCONNECT_TIMEOUT = '3'
  return env
}

export async function psql(args, input, options = {}) {
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  return run('psql', [LOCAL_DATABASE_URL, '-X', '-v', 'ON_ERROR_STOP=1',
    '-v', `test_project=${LOCAL_DATABASE.projectId}`, ...args], {
    cwd: databaseRoot, env: safeEnvironment(), input, capture: options.capture,
  })
}

export function query(sql) {
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  const result = spawnSync('psql', [LOCAL_DATABASE_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', sql], {
    cwd: databaseRoot, env: safeEnvironment(), encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr || 'psql query failed')
  return result.stdout.trim()
}

export async function bootstrapDatabase() {
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  const baseline = await readVerifiedBaseline()

  let serverVersion = ''
  const version = spawnSync('psql', [LOCAL_DATABASE_URL, '-X', '-Atqc', 'show server_version_num'], {
    cwd: databaseRoot, env: safeEnvironment(), encoding: 'utf8',
  })
  if (version.status !== 0) throw new Error('Dedicated local database is unavailable')
  serverVersion = Number.parseInt(version.stdout.trim(), 10)
  if (!Number.isInteger(serverVersion)) throw new Error('Could not establish local PostgreSQL version')

  await psql([], await readFile(setupUrl, 'utf8'))
  await psql([], makePostgres15Compatible(baseline, serverVersion))
  await psql([], await readFile(storeCatalogMigrationUrl, 'utf8'))
  await psql([], await readFile(storeManagementMigrationUrl, 'utf8'))
  await psql([], await readFile(storeImageManagementMigrationUrl, 'utf8'))
  await psql([], await readFile(storeVariantManagementMigrationUrl, 'utf8'))
  await psql([], await readFile(storeVariantPriceManagementMigrationUrl, 'utf8'))
  await psql([], await readFile(storeInventoryManagementMigrationUrl, 'utf8'))
  await psql([], await readFile(new URL('../../../supabase/migrations/20261006000000_evo_store_checkout_reservation_foundation.sql', import.meta.url), 'utf8'))
  await psql(['-c', 'CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions'])
}
