import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  EXPECTED_BASELINE_SHA256,
  makePostgres15Compatible,
  readVerifiedBaseline,
  sha256,
} from './helpers/baseline.mjs'
import { LOCAL_DATABASE_URL, LOCAL_DATABASE, validateDisposableTarget } from './helpers/local-target.mjs'
import { run } from './helpers/process.mjs'

test('baseline is pinned and immutable before restoration', async () => {
  const baseline = await readVerifiedBaseline()
  assert.equal(sha256(Buffer.from(baseline)), EXPECTED_BASELINE_SHA256)
})

test('target validation accepts only the canonical dedicated loopback target', () => {
  assert.deepEqual(validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId), {
    url: LOCAL_DATABASE_URL, projectId: LOCAL_DATABASE.projectId,
  })
  for (const [url, project] of [
    ['postgresql://postgres:postgres@localhost:55432/postgres', LOCAL_DATABASE.projectId],
    ['postgresql://postgres:postgres@127.0.0.1:5432/postgres', LOCAL_DATABASE.projectId],
    ['postgresql://postgres:postgres@db.example.com:55432/postgres', LOCAL_DATABASE.projectId],
    ['postgresql://postgres:postgres@db.abc.supabase.co:5432/postgres', LOCAL_DATABASE.projectId],
    [LOCAL_DATABASE_URL, 'production-project'],
  ]) assert.throws(() => validateDisposableTarget(url, project), /Refusing/)
})

test('PostgreSQL compatibility adjustment is narrow and ephemeral', async () => {
  const baseline = await readVerifiedBaseline()
  const transformed = makePostgres15Compatible(baseline, 150000)
  assert.doesNotMatch(transformed, /\bMAINTAIN\b/)
  assert.match(baseline, /\bMAINTAIN\b/)
  assert.equal(makePostgres15Compatible(baseline, 170000), baseline)
  assert.equal(sha256(Buffer.from(await readFile(new URL(
    './supabase/migrations/00000000000000_effective_schema.sql', import.meta.url,
  )))), EXPECTED_BASELINE_SHA256)
})

test('generic database environment variables cannot alter the canonical target', async () => {
  const previous = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://production.invalid/database'
  try {
    const targetModule = await import(`./helpers/local-target.mjs?cache=${Date.now()}`)
    assert.equal(targetModule.LOCAL_DATABASE_URL, LOCAL_DATABASE_URL)
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previous
  }
})

// Write synchronously: process.exit() may discard pending stream writes.
test('captured subprocess failures retain the underlying diagnostic', async () => {
  await assert.rejects(
    run(process.execPath, ['-e', "require('node:fs').writeSync(2, 'FIRST_SQL_ERROR\\n'); process.exit(3)"], {
      capture: true,
    }),
    error => error.message.includes('exited with status 3')
      && error.message.includes('FIRST_SQL_ERROR'),
  )
})

test('captured subprocess success retains stdout and stderr through stream closure', async () => {
  const output = await run(process.execPath, ['-e',
    "const fs = require('node:fs'); fs.writeSync(1, 'CAPTURED_STDOUT\\n'); fs.writeSync(2, 'CAPTURED_STDERR\\n');",
  ], { capture: true })
  assert.ok(output.includes('CAPTURED_STDOUT'))
  assert.ok(output.includes('CAPTURED_STDERR'))
})

// No database execution: pins the exact five migration inputs and order used by CI.
test('atomic deployment uses unchanged reviewed migration bytes in one transaction', async () => {
  const { readAtomicStoreMigrations, atomicStoreTransaction } = await import('./helpers/atomic-store-migrations.mjs')
  const migrations = await readAtomicStoreMigrations()
  assert.equal(migrations.length, 5)
  const script = atomicStoreTransaction(migrations)
  assert.match(script, /^BEGIN;\nSET LOCAL lock_timeout/)
  assert.match(script, /\nCOMMIT;$/)
  let position = 0
  for (const body of migrations) {
    const next = script.indexOf(body, position)
    assert.ok(next >= position, 'exact body preserved in required order')
    position = next + body.length
  }
})

test('CRLF successor pins every original and changes only checksum comparison', async () => {
  const { readCompatibleStoreMigrations } = await import('./helpers/compatible-store-migrations.mjs')
  const { readAtomicStoreMigrations, atomicStoreTransaction } = await import('./helpers/atomic-store-migrations.mjs')
  const compatible = await readCompatibleStoreMigrations()
  const original = await readAtomicStoreMigrations()
  assert.deepEqual(compatible.slice(0, 4), original.slice(0, 4))
  const stripComments = sql => sql.replace(/^\s*--[^\n]*\n/gm, '')
  const normalized = compatible[4].replace(
    'pg_catalog.md5(pg_catalog.replace(guard.prosrc,\n       pg_catalog.chr(13) || pg_catalog.chr(10), pg_catalog.chr(10)))',
    'pg_catalog.md5(guard.prosrc)')
  assert.equal(stripComments(normalized), stripComments(original[4]), 'all other validation and DDL remain identical')
  const transaction = atomicStoreTransaction(compatible)
  assert.ok(!transaction.includes(original[4]), 'strict-LF predecessor is substituted, never appended')
  for (const body of compatible) assert.ok(transaction.includes(body), 'byte-preserved deployment bodies')
})
