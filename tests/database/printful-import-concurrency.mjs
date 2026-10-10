import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const adminId = '12000000-0000-4000-8000-000000000001'
const categoryId = '32000000-0000-4000-8000-000000000201'
const payload = {
  syncProductId: '99009001', title: 'POD concurrency test', slug: 'printful-99009001',
  variants: [
    { syncId: '99009011', catalogId: '401', sku: 'TEST-POD-BLACK-S', size: 'S', color: 'BLACK' },
    { syncId: '99009012', catalogId: '402', sku: 'TEST-POD-BLACK-M', size: 'M', color: 'BLACK' }
  ]
}
const quoted = JSON.stringify(payload).replaceAll("'", "''")
const importSql = `public.import_evo_store_printful_draft('990001', '${categoryId}', '${quoted}'::jsonb)`
const auth = `SET LOCAL ROLE authenticated; SELECT pg_catalog.set_config('request.jwt.claim.sub','${adminId}',true);`

export function registerPrintfulImportConcurrency(serialTest, { psql, query, resetDatabase }) {
  serialTest('Printful importer creates one draft under concurrent admin calls, replays safely and rolls back invalid variants', async () => {
    // All calls are restricted to the canonical disposable loopback database via psql/query.
    await resetDatabase()
    for (const name of [
      '20261009020000_evo_store_category_hierarchy.sql',
      '20261009050000_evo_store_printful_mapping_foundation.sql',
      '20261009060000_printful_atomic_draft_import.sql',
      '20261009070000_printful_pod_publication_lock.sql',
      '20261009080000_printful_mockup_ingestion_ledger.sql',
      '20261010010000_printful_mockup_reservation.sql'
    ]) {
      await psql([], await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'))
    }
    await psql([], `
      INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,
        email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      VALUES ('${adminId}','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','pod-test@example.test','',now(),'{}','{}',now(),now())
      ON CONFLICT DO NOTHING;
      INSERT INTO public.profiles(id,username) VALUES ('${adminId}','pod-test') ON CONFLICT DO NOTHING;
      INSERT INTO public.roles(id,code,name) VALUES ('22000000-0000-4000-8000-000000000001','admin','Administrator')
        ON CONFLICT (code) DO NOTHING;
      INSERT INTO public.user_roles(user_id,role_id) SELECT '${adminId}',id
        FROM public.roles WHERE code='admin' ON CONFLICT DO NOTHING;
      INSERT INTO public.evo_store_categories(id,name,slug,is_active)
        VALUES ('${categoryId}','POD Test','pod-import-test',true);
      INSERT INTO private.evo_store_printful_stores(external_store_id,display_name)
        VALUES ('990001','Isolated Test Store');
    `)
    const run = (sql, tail = 'COMMIT;') => psql(['-Atq'], `BEGIN; SET LOCAL statement_timeout='10s';
      ${auth} SELECT ${sql}; ${tail}`, { capture: true })
    const outcomes = await Promise.all([run(importSql), run(importSql)])
    const ids = outcomes.map(s => s.trim().split('\n').filter(x => /^[a-f0-9-]{36}$/.test(x)).at(-1))
    assert.ok(ids.every(Boolean), 'Both import calls returned product UUIDs')
    assert.equal(ids[0], ids[1], 'Concurrent imports return same draft')
    assert.equal((await run(importSql)).trim().split('\n').filter(x => /^[a-f0-9-]{36}$/.test(x)).at(-1), ids[0], 'Retry returns mapped draft')
    assert.equal(query("SELECT count(*) FROM private.evo_store_printful_product_maps WHERE sync_product_id='99009001'"), '1')
    assert.equal(query("SELECT count(*) FROM private.evo_store_printful_variant_maps"), '2')
    assert.equal(query(`SELECT publication_status::text FROM public.evo_store_products WHERE id='${ids[0]}'`), 'draft')
    assert.equal(query(`SELECT count(*) FROM public.evo_store_variants WHERE product_id='${ids[0]}' AND is_active`), '0')
    await assert.rejects(
      psql([], `UPDATE public.evo_store_products SET publication_status='published'
        WHERE id='${ids[0]}'`, { capture: true }),
      /PRINTFUL_FULFILLMENT_NOT_READY/,
      'Mapped POD product cannot be published'
    )
    await assert.rejects(
      psql([], `UPDATE public.evo_store_variants SET is_active=true
        WHERE product_id='${ids[0]}'`, { capture: true }),
      /PRINTFUL_FULFILLMENT_NOT_READY/,
      'Mapped POD variants cannot be activated'
    )
    assert.equal(query(`SELECT publication_status::text FROM public.evo_store_products WHERE id='${ids[0]}'`), 'draft')
    assert.equal(query(`SELECT count(*) FROM public.evo_store_variants WHERE product_id='${ids[0]}' AND is_active`), '0')
    const ledger = 'private.evo_store_printful_mockup_ingestions'
    assert.equal(query(`SELECT relrowsecurity FROM pg_class WHERE oid='${ledger}'::regclass`),'t')
    assert.equal(query(`SELECT has_table_privilege('authenticated','${ledger}','SELECT')`),'f')
    assert.equal(query(`SELECT has_table_privilege('service_role','${ledger}','INSERT')`),'f')
    const imageId = 'deda5293-05f9-4e7c-8ba0-8a500b10a002'
    await psql([], `INSERT INTO ${ledger}(product_id,printful_file_id,color_code,storage_path)
      VALUES ('${ids[0]}',1082848720,'BLACK','${ids[0]}/${imageId}.png')`)
    assert.equal(query(`SELECT status FROM ${ledger} WHERE printful_file_id=1082848720`),'pending')
    await assert.rejects(psql([], `INSERT INTO ${ledger}(product_id,printful_file_id,color_code,storage_path)
      VALUES ('${ids[0]}',1082848720,'BLACK','${ids[0]}/${imageId}.png')`,
      {capture:true}),/duplicate key value/, 'File ID cannot be claimed twice')
    assert.equal(query(`SELECT count(*) FROM ${ledger}`),'1')
    // The reservation RPC must reject a normal member identity, and must
    // reject a properly authorized admin when product identity is not verified.
    const reserve = `public.reserve_evo_store_printful_mockup('${ids[0]}',1082848720,
      'BLACK','${ids[0]}/deda5293-05f9-4e7c-8ba0-8a500b10a002.png',0,'EvoLeveX black T-shirt front')`
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
      SELECT ${reserve}; COMMIT;`,{capture:true}),/PRINTFUL_MEDIA_FORBIDDEN/)
    await assert.rejects(run(reserve),/PRINTFUL_MEDIA_PRODUCT_UNVERIFIED/)
    const invalid = { ...payload, syncProductId: '99009002', slug: 'printful-99009002', variants: [
      { ...payload.variants[0], syncId: '99009021', catalogId: '421', sku: 'TEST-POD-ROLLBACK-S' }, { ...payload.variants[1], syncId: '99009022', catalogId: '422', sku: 'INVALID SKU SPACE' }
    ] }
    const invalidSql = `public.import_evo_store_printful_draft('990001', '${categoryId}', '${JSON.stringify(invalid)}'::jsonb)`
    await assert.rejects(run(invalidSql), /PRINTFUL_IMPORT_VARIANT_INVALID/)
    assert.equal(query("SELECT count(*) FROM private.evo_store_printful_product_maps"), '1', 'Failed import rolls back mapping')
    assert.equal(query("SELECT count(*) FROM public.evo_store_products WHERE slug='printful-99009002'"), '0', 'Failed import rolls back product')
    assert.equal(query("SELECT count(*) FROM public.evo_store_variants WHERE sku='INVALID SKU SPACE'"), '0', 'Failed import rolls back variants')
  })
}
