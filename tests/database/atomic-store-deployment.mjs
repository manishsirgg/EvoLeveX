import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { registerGuardPrerequisiteDiagnostics } from './guard-prerequisite-diagnostics.mjs'
import { ATOMIC_STORE_MIGRATIONS, readAtomicStoreMigrations, atomicStoreTransaction } from './helpers/atomic-store-migrations.mjs'

const objectsAbsent = `SELECT
 to_regprocedure('public.adjust_evo_store_inventory(uuid,text,integer,text)') IS NULL
 AND to_regprocedure('private.guard_evo_store_archived_product_inventory()') IS NULL
 AND to_regprocedure('public.create_evo_store_checkout(jsonb,text,uuid,uuid)') IS NULL
 AND to_regprocedure('public.release_evo_store_checkout(uuid)') IS NULL
 AND to_regprocedure('public.expire_evo_store_checkouts(integer)') IS NULL
 AND to_regclass('public.evo_store_checkouts') IS NULL
 AND to_regclass('public.evo_store_checkout_items') IS NULL
 AND to_regclass('private.evo_store_checkout_expiry_failures') IS NULL
 AND to_regtype('public.evo_store_checkout_status') IS NULL
 AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='evo_store_inventory_guard_archived');`
const counts = `SELECT jsonb_build_array(
 (SELECT count(*) FROM public.evo_store_products),
 (SELECT count(*) FROM public.evo_store_variants),
 (SELECT count(*) FROM public.evo_store_variant_prices),
 (SELECT count(*) FROM public.evo_store_inventory),
 (SELECT count(*) FROM public.evo_store_inventory_movements));`
const snapshot = `SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proname,p.prosrc,p.proowner,p.prosecdef,p.proconfig,p.proacl) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private')),
 'tables',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relacl,c.relrowsecurity) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.oid,k.conname,pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname IN ('public','private')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')),
 'enums',(SELECT jsonb_agg(jsonb_build_array(t.oid,t.typname,e.enumlabel) ORDER BY t.oid,e.enumsortorder) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public'));`

export function registerAtomicStoreDeployment(serialTest, { psql, query, bootstrapDatabase }) {
  serialTest('atomic deployment: verified pre-inventory schema reproduces empty production drift', async () => {
    // No destructive reset here: before() restores the pinned baseline plus only
    // catalog migrations preceding 20261005040000, then removes the OLD RPC.
    assert.equal(query(objectsAbsent), 't')
    assert.equal(query(counts), '[0, 0, 0, 0, 0]')
    const files = await readAtomicStoreMigrations()
    assert.equal(files.length, 5)
    for (const [name, checksum] of ATOMIC_STORE_MIGRATIONS) console.info(`atomic migration SHA256 ${name}: ${checksum}`)
  })

  registerGuardPrerequisiteDiagnostics(serialTest, { psql, query, objectsAbsent })

  for (let checkpoint = 1; checkpoint <= 5; checkpoint += 1) {
    serialTest(`atomic deployment: failure after migration ${checkpoint} rolls back complete transaction`, async () => {
      assert.equal(query(objectsAbsent), 't')
      const before = query(snapshot)
      await assert.rejects(psql([], atomicStoreTransaction(await readAtomicStoreMigrations(), checkpoint), { capture: true }), /ATOMIC_STORE_TEST_FAILURE/)
      // Failed psql exits with ON_ERROR_STOP; connection close rolls back the
      // uncommitted transaction. Inspect from a fresh independent connection.
      assert.equal(query(objectsAbsent), 't')
      assert.equal(query(snapshot), before, 'all schema bodies/ACLs/triggers/constraints restored')
      assert.equal(query(counts), '[0, 0, 0, 0, 0]')
    })
  }

  serialTest('atomic deployment: five unchanged migrations COMMIT and preserve empty Store data', async () => {
    assert.equal(query(objectsAbsent), 't')
    const output = await psql([], atomicStoreTransaction(await readAtomicStoreMigrations()), { capture: true })
    assert.match(output, /(?:^|\n)COMMIT(?:\r?\n|$)/)
    assert.equal(query(counts), '[0, 0, 0, 0, 0]')
    assert.equal(query(`SELECT count(*) FROM public.evo_store_checkouts;`), '0')
    // Independent connection proves persistence, not merely visibility inside BEGIN.
    const verification = await readFile(new URL('./supabase/tests/013_atomic_store_deployment.sql', import.meta.url), 'utf8')
    const result = await psql(['-Atq'], verification, { capture: true })
    assert.match(result, /1\.\.[0-9]+/)
    assert.doesNotMatch(result, /^not ok\b/m)
    console.info(`atomic committed-state pgTAP: ${result.match(/1\.\.([0-9]+)/)[1]} assertions`)
    // Run the real expiry/archived-release invariants against the combined state.
    const expiry = await psql(['-Atq', '-f', new URL('./supabase/tests/012_store_checkout_expiry.sql', import.meta.url).pathname], undefined, { capture: true })
    assert.doesNotMatch(expiry, /^not ok\b/m)
    assert.match(expiry, /1\.\.61\b/)
    console.info('atomic committed-state expiry pgTAP: 61 assertions')
    assert.equal(query(counts), '[0, 0, 0, 0, 0]')
  })

  serialTest('atomic deployment: restore unchanged phased baseline for all existing regressions', async () => {
    await bootstrapDatabase()
    assert.equal(query("SELECT to_regprocedure('public.expire_evo_store_checkouts(integer)') IS NULL;"), 't')
  })
}
