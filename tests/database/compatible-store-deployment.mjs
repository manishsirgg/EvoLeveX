import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { atomicStoreTransaction } from './helpers/atomic-store-migrations.mjs'
import { COMPATIBLE_GUARD_MIGRATION, readCompatibleStoreMigrations } from './helpers/compatible-store-migrations.mjs'
import { registerInventoryGuardRepair } from './inventory-guard-repair.mjs'

const guard = "'private.guard_evo_store_archived_product_inventory()'::regprocedure"
const absent = `SELECT to_regclass('public.evo_store_checkouts') IS NULL
 AND to_regprocedure('public.adjust_evo_store_inventory(uuid,text,integer,text)') IS NULL
 AND to_regprocedure('private.guard_evo_store_archived_product_inventory()') IS NULL
 AND to_regprocedure('public.expire_evo_store_checkouts(integer)') IS NULL
 AND to_regclass('private.evo_store_checkout_expiry_failures') IS NULL;`
const snapshot = `SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private')),
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','private')),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')),
 'types',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','private')),
 'enums',(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.oid) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','private')));`
const transport = (sql, ending) => ending === 'CRLF' ? sql.replaceAll('\n', '\r\n') : sql

export function registerCompatibleStoreDeployment(serialTest, { psql, query, resetPreInventory }) {
  for (const ending of ['LF', 'CRLF']) {
    for (let checkpoint = 1; checkpoint <= 5; checkpoint += 1) {
      serialTest(`compatible ${ending}: complete rollback after migration ${checkpoint}`, async () => {
        assert.equal(query(absent), 't')
        const before = query(snapshot)
        const transaction = atomicStoreTransaction(await readCompatibleStoreMigrations(), checkpoint)
        await assert.rejects(psql([], transport(transaction, ending), { capture: true }), /ATOMIC_STORE_TEST_FAILURE/)
        assert.equal(query(absent), 't')
        assert.equal(query(snapshot), before, 'bodies, ownership, ACLs, RLS, constraints, triggers and types restored')
      })
    }
    serialTest(`compatible ${ending}: five checksum-pinned migrations COMMIT with security and archived-release invariants`, async () => {
      assert.equal(query(absent), 't')
      await psql(['-Atq', '-f', new URL('../../docs/deployment/store-crlf/B-pre-execution-verification.sql', import.meta.url).pathname], undefined, { capture: true })
      const result = await psql([], transport(atomicStoreTransaction(await readCompatibleStoreMigrations()), ending), { capture: true })
      assert.match(result, /(?:^|\n)COMMIT(?:\r?\n|$)/)
      assert.equal(query(`SELECT md5(prosrc) FROM pg_proc WHERE oid=${guard};`), ending === 'LF'
        ? 'b1ac65d9a274ab4c40a6451e78d790cb' : '7386206d88a4735f318572eb29878317')
      // Keep the original strict-LF suite intact. This additional suite checks
      // exactly the same canonical body after ONLY CRLF-pair normalization.
      const original = await readFile(new URL('./supabase/tests/013_atomic_store_deployment.sql', import.meta.url), 'utf8')
      assert.equal(original.split('md5(prosrc)').length, 2)
      const verification = original.replace('md5(prosrc)', 'md5(replace(prosrc,chr(13)||chr(10),chr(10)))')
      const security = await psql(['-Atq'], verification, { capture: true })
      assert.match(security, /1\.\.54\b/)
      assert.doesNotMatch(security, /^not ok\b/m)
      const expiry = await psql(['-Atq', '-f', new URL('./supabase/tests/012_store_checkout_expiry.sql', import.meta.url).pathname], undefined, { capture: true })
      assert.match(expiry, /1\.\.61\b/)
      assert.doesNotMatch(expiry, /^not ok\b/m)
      assert.equal(query(`SELECT jsonb_build_array(
        (SELECT count(*) FROM public.evo_store_products),(SELECT count(*) FROM public.evo_store_variants),
        (SELECT count(*) FROM public.evo_store_variant_prices),(SELECT count(*) FROM public.evo_store_inventory),
        (SELECT count(*) FROM public.evo_store_inventory_movements));`), '[0, 0, 0, 0, 0]')
      await psql(['-Atq', '-f', new URL('../../docs/deployment/store-crlf/C-post-deployment-verification.sql', import.meta.url).pathname], undefined, { capture: true })
      console.info(`compatible ${ending}: COMMIT; 54 security + 61 expiry assertions; canonical MD5; stock/ledger unchanged`)
    })
    // Exercise ALL original security/wiring negative cases against the successor
    // on both stored-body encodings, without replacing the original D regressions.
    const taggedTest = (name, fn) => serialTest(`compatible ${ending}: ${name}`, fn)
    registerInventoryGuardRepair(taggedTest, { psql, query,
      migrationUrl: new URL(`../../supabase/migrations/${COMPATIBLE_GUARD_MIGRATION[0]}`, import.meta.url) })
    for (const [label, expression] of [
      ['extra whitespace', "' ' || p.prosrc"],
      ['lone carriage return', "chr(13) || p.prosrc"],
      ['changed business logic', "replace(p.prosrc,'quantity_reserved','quantity_on_hand')"],
    ]) {
      serialTest(`compatible ${ending}: reject ${label}`, async () => {
        const migrations = await readCompatibleStoreMigrations()
        // Recreate the function with identical metadata but a noncanonical body;
        // dollar-quoted format preserves the chosen line endings exactly.
        const mutation = `DO $test$ DECLARE body text; BEGIN
          SELECT ${expression} INTO body FROM pg_proc p WHERE p.oid=${guard};
          EXECUTE format('CREATE OR REPLACE FUNCTION private.guard_evo_store_archived_product_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = %L AS %L', '', body);
        END $test$;`
        // Installed functions make this full metadata snapshot larger than
        // spawnSync's default 1 MiB stdout buffer. Capture asynchronously so
        // the assertion compares every byte rather than truncating the snapshot.
        const before = await psql(['-Atq'], snapshot, { capture: true })
        console.info(`compatible ${ending} ${label}: metadata snapshot ${Buffer.byteLength(before)} bytes`)
        await assert.rejects(psql([], `BEGIN; ${mutation} ${migrations[4]} COMMIT;`, { capture: true }), /EVO_STORE_INVENTORY_GUARD_PREREQUISITE/)
        assert.equal(await psql(['-Atq'], snapshot, { capture: true }), before)
      })
    }
    serialTest(`compatible ${ending}: reset fixed disposable stack to verified production drift`, resetPreInventory)
  }
}
