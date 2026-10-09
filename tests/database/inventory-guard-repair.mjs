import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../../supabase/migrations/20261009000000_evo_store_archived_inventory_guard_compatibility.sql', import.meta.url)
const guardName = 'private.guard_evo_store_archived_product_inventory()'
const triggerName = 'evo_store_inventory_guard_archived'
const drop = `DROP TRIGGER ${triggerName} ON public.evo_store_inventory;`
const trigger = (options = {}) => `CREATE TRIGGER ${triggerName}
  ${options.timing ?? 'BEFORE'} ${options.events ?? 'INSERT OR UPDATE OR DELETE'}
  ON ${options.table ?? 'public.evo_store_inventory'} FOR EACH ${options.level ?? 'ROW'}
  ${options.when ?? ''} EXECUTE FUNCTION ${options.fn ?? guardName};`
const exact = `SELECT count(*) FROM pg_trigger WHERE
  tgrelid='public.evo_store_inventory'::regclass AND tgname='${triggerName}'
  AND tgfoid='${guardName}'::regprocedure AND tgtype=31 AND tgenabled='O'
  AND tgqual IS NULL AND tgnargs=0 AND tgattr=''::int2vector
  AND NOT tgisinternal AND tgconstraint=0
  AND tgoldtable IS NULL AND tgnewtable IS NULL;`

export function registerInventoryGuardRepair(serialTest, { psql, query }) {
  serialTest('guard repair: normal schema preserves function, trigger and inventory', async () => {
    const migration = await readFile(migrationUrl, 'utf8')
    const snapshot = () => query(`SELECT jsonb_build_object(
      'function', (SELECT to_jsonb(p) FROM pg_proc p WHERE oid='${guardName}'::regprocedure),
      'trigger', (SELECT to_jsonb(t) FROM pg_trigger t WHERE tgrelid='public.evo_store_inventory'::regclass AND tgname='${triggerName}'),
      'inventory', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY variant_id),'[]') FROM public.evo_store_inventory i),
      'movements', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]') FROM public.evo_store_inventory_movements m),
      'table', (SELECT to_jsonb(c) FROM pg_class c WHERE oid='public.evo_store_inventory'::regclass));`)
    const before = snapshot()
    await psql([], migration)
    await psql([], migration)
    assert.equal(query(exact), '1')
    assert.equal(snapshot(), before)
  })

  serialTest('guard repair: absent trigger restored without replacing the guard', async () => {
    const migration = await readFile(migrationUrl, 'utf8')
    const output = await psql(['-Atq'], `BEGIN; ${drop}
      ${migration}
      ${exact}
      ROLLBACK;`, { capture: true })
    assert.equal(output.trim(), '1')
    assert.equal(query(exact), '1')
  })

  const badWiring = [
    ['wrong function', trigger({ fn: 'public.set_updated_at()' })],
    ['missing INSERT/DELETE', trigger({ events: 'UPDATE' })],
    ['wrong timing', trigger({ timing: 'AFTER' })],
    ['statement level', trigger({ level: 'STATEMENT' })],
    ['disabled', `${trigger()} ALTER TABLE public.evo_store_inventory DISABLE TRIGGER ${triggerName};`],
    ['replica only', `${trigger()} ALTER TABLE public.evo_store_inventory ENABLE REPLICA TRIGGER ${triggerName};`],
    ['always enabled', `${trigger()} ALTER TABLE public.evo_store_inventory ENABLE ALWAYS TRIGGER ${triggerName};`],
    ['WHEN filter', trigger({ when: 'WHEN (true)' })],
    ['column filter', trigger({ events: 'UPDATE OF quantity_reserved' })],
    ['arguments', trigger({ fn: "private.guard_evo_store_archived_product_inventory('unexpected')" })],
    ['wrong table', trigger({ table: 'public.evo_store_inventory_movements' })],
  ]
  for (const [label, definition] of badWiring) {
    serialTest(`guard repair rejects ${label}`, async () => {
      const migration = await readFile(migrationUrl, 'utf8')
      await assert.rejects(psql([], `BEGIN; ${drop} ${definition} ${migration} COMMIT;`, { capture: true }),
        /EVO_STORE_INVENTORY_GUARD_WIRING/)
      assert.equal(query(exact), '1', 'rejected transaction preserves canonical wiring')
    })
  }

  const incompatible = [
    ['missing function', `DROP FUNCTION ${guardName};`],
    ['security invoker', `ALTER FUNCTION ${guardName} SECURITY INVOKER;`],
    ['unsafe search_path', `ALTER FUNCTION ${guardName} SET search_path=public;`],
    ['untrusted owner', `ALTER FUNCTION ${guardName} OWNER TO authenticated;`],
    ['PUBLIC execute', `GRANT EXECUTE ON FUNCTION ${guardName} TO PUBLIC;`],
    ['anon execute', `GRANT EXECUTE ON FUNCTION ${guardName} TO anon;`],
    ['authenticated execute', `GRANT EXECUTE ON FUNCTION ${guardName} TO authenticated;`],
    ['strict old body', null],
  ]
  for (const [label, alteration] of incompatible) {
    serialTest(`guard repair rejects prerequisite: ${label}`, async () => {
      const migration = await readFile(migrationUrl, 'utf8')
      const original = await readFile(new URL('../../supabase/migrations/20261005040000_evo_store_inventory_management_support.sql', import.meta.url), 'utf8')
      const strictGuard = original.slice(original.indexOf('create or replace function'), original.indexOf('revoke all on function'))
      await assert.rejects(psql([], `BEGIN; ${drop} ${alteration ?? strictGuard} ${migration} COMMIT;`, { capture: true }),
        /EVO_STORE_INVENTORY_GUARD_PREREQUISITE/)
      assert.equal(query(exact), '1')
    })
  }

  serialTest('guard repair: restored trigger preserves archived reservation-release invariants', async () => {
    const migration = await readFile(migrationUrl, 'utf8')
    const output = await psql(['-Atq'], `BEGIN; ${drop} ${migration}
      \\i ${new URL('./supabase/tests/012_store_checkout_expiry.sql', import.meta.url).pathname}
      `, { capture: true })
    assert.match(output, /1\.\.[0-9]+/)
    assert.doesNotMatch(output, /^not ok\b/m)
    console.info(`restored guard: ${output.match(/1\.\.([0-9]+)/)[1]} expiry pgTAP assertions`)
    assert.equal(query(exact), '1')
  })
}
