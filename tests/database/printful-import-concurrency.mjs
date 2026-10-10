import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { run as runCommand } from './helpers/process.mjs'

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
      '20261010010000_printful_mockup_reservation.sql',
      '20261010020000_printful_mockup_upload_finalize.sql',
      '20261010030000_printful_mockup_recovery_diagnostics.sql'
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
    // Genuine HTTP request against the disposable local Storage service.
    // This cannot reach any cloud Supabase endpoint and uses no project secrets.
    const storageEndpoint = new URL(
      `http://127.0.0.1:55431/storage/v1/object/evo-store-products/${ids[0]}/unauthorized.png`
    )
    assert.equal(storageEndpoint.hostname,'127.0.0.1')
    assert.equal(storageEndpoint.port,'55431')
    const httpDenied = await fetch(storageEndpoint, {
      method:'POST',
      headers: {'content-type':'image/png','x-upsert':'false'},
      body: Uint8Array.of(137,80,78,71,13,10,26,10),
      signal: AbortSignal.timeout(5000),
    })
    assert.ok([400,401,403].includes(httpDenied.status),
      `Unauthenticated HTTP Storage upload must be denied, got ${httpDenied.status}`)
    assert.equal(query(`SELECT count(*) FROM storage.objects WHERE
      bucket_id='evo-store-products' AND name='${ids[0]}/unauthorized.png'`),
      '0','Rejected HTTP upload must not create Storage metadata')
    // Database-level Storage RLS checks; real HTTP uploads remain a separate gate.
    const nextObject = `${ids[0]}/deda5293-05f9-4e7c-8ba0-8a500b10a003.png`
    await assert.rejects(
      psql([], `BEGIN; SET LOCAL ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
        INSERT INTO storage.objects(bucket_id,name) VALUES ('evo-store-products','${nextObject}');
        COMMIT;`, {capture:true}),
      /row-level security|permission denied/i,
      'Unauthorised account cannot insert a product Storage object')
    await assert.rejects(
      psql([], `BEGIN; ${auth}
        INSERT INTO storage.objects(bucket_id,name) VALUES ('evo-store-products','${nextObject}');
        COMMIT;`, {capture:true}),
      /row-level security|permission denied/i,
      'A staff member cannot insert a Storage object without image metadata')
    // This fixture has not inserted a Storage object yet. Failed inserts
    // must leave the unreserved target absent; HTTP conflict behavior is separate.
    assert.equal(query(`SELECT count(*) FROM storage.objects WHERE
      bucket_id='evo-store-products' AND name='${nextObject}'`),
      '0', 'Rejected unauthorized inserts do not create an unreserved object')
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
    // Fault-injection diagnostics on the isolated database only.
    // Rebind this synthetic product to the fixed allowlisted Printful identity;
    // the SQL does not reach any production Supabase project.
    await psql([], `UPDATE public.evo_store_products SET slug='printful-479728769'
      WHERE id='${ids[0]}';
      UPDATE private.evo_store_printful_product_maps
      SET sync_product_id='479728769' WHERE product_id='${ids[0]}';`)
    const inspect = file => `(SELECT recovery_state FROM public.inspect_evo_store_printful_mockup_recovery(
      '${ids[0]}',${file}))`
    assert.equal((await run(inspect(1082848721))).trim().split('\n').at(-1), 'NOT_RESERVED',
      'Missing reservation must not be treated as an uploaded image')
    assert.equal((await run(inspect(1082848720))).trim().split('\n').at(-1), 'MANUAL_REVIEW_REQUIRED',
      'A ledger row without matching image metadata is inconsistent')
    await psql([], `INSERT INTO public.evo_store_product_images
      (product_id,storage_bucket,storage_path,alt_text,sort_order,is_primary,is_active)
      VALUES ('${ids[0]}','evo-store-products','${ids[0]}/${imageId}.png',
       'EvoLeveX test front mockup',0,false,false)`)
    assert.equal((await run(inspect(1082848720))).trim().split('\n').at(-1), 'PENDING_OBJECT_MISSING',
      'Reservation and inactive metadata without Storage object remains pending')
    await assert.rejects(run(`public.complete_evo_store_printful_mockup(
      '${ids[0]}',1082848720,'${ids[0]}/${imageId}.png')`),
      /PRINTFUL_MEDIA_OBJECT_MISSING/,
      'Finalization must fail if Storage object is absent')
    assert.equal(query(`SELECT is_active FROM public.evo_store_product_images
      WHERE product_id='${ids[0]}'`),'f','Failed finalization must keep image inactive')
    assert.equal(query(`SELECT status FROM ${ledger} WHERE product_id='${ids[0]}'`),
      'pending','Failed finalization must not promote the ledger')
    await assert.rejects(psql([], `BEGIN; SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
      SELECT ${inspect(1082848720)}; COMMIT;`,{capture:true}),
      /PRINTFUL_MEDIA_FORBIDDEN/, 'Non-admin recovery inspection denied')
    assert.equal(query(`SELECT count(*) FROM ${ledger}`),'1',
      'Recovery inspection and failed finalization do not create extra reservations')
    // Simulate an object whose bytes reached Storage before finalization.
    // This exercises database recovery classification only; it is not a real
    // Storage API upload or content-integrity test.
    await psql([], `INSERT INTO storage.objects(bucket_id,name)
      VALUES ('evo-store-products','${ids[0]}/${imageId}.png')`)
    assert.equal((await run(inspect(1082848720))).trim().split('\n').at(-1),
      'PENDING_OBJECT_PRESENT',
      'Interrupted finalization should recognize a present object and inactive metadata')
    await run(`public.complete_evo_store_printful_mockup(
      '${ids[0]}',1082848720,'${ids[0]}/${imageId}.png')`)
    assert.equal((await run(inspect(1082848720))).trim().split('\n').at(-1),
      'COMPLETE', 'Successful finalization must be observable')
    assert.equal(query(`SELECT status FROM ${ledger} WHERE product_id='${ids[0]}'`),
      'verified','Finalization changes the ledger exactly once')
    assert.equal(query(`SELECT is_active FROM public.evo_store_product_images
      WHERE product_id='${ids[0]}'`),'t','Finalization activates only the reserved image')
    await assert.rejects(run(`public.complete_evo_store_printful_mockup(
      '${ids[0]}',1082848720,'${ids[0]}/${imageId}.png')`),
      /PRINTFUL_MEDIA_RESERVATION_INVALID/,
      'Repeated finalization fails closed without duplicating images')
    assert.equal(query(`SELECT count(*) FROM public.evo_store_product_images
      WHERE product_id='${ids[0]}'`),'1')
    assert.equal(query(`SELECT count(*) FROM ${ledger}`),'1')

    // Genuine local Auth and Storage HTTP path. No cloud endpoints or production tokens.
    await psql([], `UPDATE auth.users SET encrypted_password=crypt('isolated-mockup-test-2026',
      gen_salt('bf')) WHERE id='${adminId}'`)
    const statusEnv = await runCommand('supabase',
      ['status','--workdir','tests/database','-o','env'], {capture:true})
    const anonKey = statusEnv.split('\n').find(line => line.startsWith('ANON_KEY='))
      ?.slice('ANON_KEY='.length).trim().replace(/^["']|["']$/g,'')
    assert.ok(anonKey, 'Disposable Supabase CLI must expose local anonymous API key')
    const localApi = 'http://127.0.0.1:55431'
    const sessionResponse = await fetch(`${localApi}/auth/v1/token?grant_type=password`, {
      method:'POST',
      headers:{apikey:anonKey,'content-type':'application/json'},
      body:JSON.stringify({email:'pod-test@example.test',password:'isolated-mockup-test-2026'}),
      signal:AbortSignal.timeout(5000),
    })
    if (sessionResponse.status !== 200) {
      const failure = await sessionResponse.json().catch(() => ({}))
      // Log only stable error classification; never print tokens or full server payloads.
      const safeCode = typeof failure.error_code === 'string'
        ? failure.error_code.slice(0,80) : 'unspecified'
      const safeError = typeof failure.error === 'string'
        ? failure.error.slice(0,80) : 'unspecified'
      // Diagnostics are from disposable local Auth only. Never emit credentials,
      // access tokens, request bodies, or unfiltered service logs.
      let localAuthHint = 'unavailable'
      try {
        const names = await runCommand('docker',['ps','--format','{{.Names}}'],{capture:true})
        const authName = names.split('\\n').find(name =>
          /^supabase_auth_evolevex-p1-003$/.test(name.trim()))
        if (authName) {
          const logs = await runCommand('docker',['logs','--tail','80',authName],{capture:true})
          const candidate = logs.split('\\n').reverse().find(line =>
            /error|fatal|database|column|relation|schema/i.test(line))
          // Classify server issues without reproducing a full log line.
          if (candidate) localAuthHint = /column|schema|relation/i.test(candidate)
            ? 'possible_auth_schema_mismatch'
            : /database|postgres/i.test(candidate) ? 'possible_database_error'
            : 'auth_server_error'
        }
      } catch { /* diagnostics must not alter assertion behavior */ }
      assert.fail(`Local admin authentication rejected: HTTP ${sessionResponse.status}; code=${safeCode}; error=${safeError}; hint=${localAuthHint}`)
    }
    const session = await sessionResponse.json()
    assert.ok(session.access_token, 'Local auth must issue admin session token')
    const httpPath = `${ids[0]}/deda5293-05f9-4e7c-8ba0-8a500b10a004.png`
    await psql([], `INSERT INTO public.evo_store_product_images
      (product_id,storage_bucket,storage_path,alt_text,sort_order,is_primary,is_active)
      VALUES ('${ids[0]}','evo-store-products','${httpPath}',
       'Isolated authenticated test image',2,false,false)`)
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64')
    const uploadUri = `${localApi}/storage/v1/object/evo-store-products/${httpPath}`
    const headers = {apikey:anonKey,authorization:`Bearer ${session.access_token}`,
      'content-type':'image/png','x-upsert':'false'}
    const upload = () => fetch(uploadUri, {method:'POST',headers,body:pngBytes,
      signal:AbortSignal.timeout(5000)})
    const firstUpload = await upload()
    assert.ok([200,201].includes(firstUpload.status),
      `Admin HTTP upload expected success; got ${firstUpload.status}: ${await firstUpload.text()}`)
    const duplicate = await upload()
    assert.equal(duplicate.status,409,'Storage HTTP rejects duplicate upload without upsert')
    const stored = await fetch(uploadUri,{headers:{
      apikey:anonKey, authorization:`Bearer ${session.access_token}`},
      signal:AbortSignal.timeout(5000)})
    assert.equal(stored.status,200,'Admin can retrieve local uploaded PNG')
    const received=Buffer.from(await stored.arrayBuffer())
    assert.equal(createHash('sha256').update(received).digest('hex'),
      createHash('sha256').update(pngBytes).digest('hex'), 'Storage bytes unchanged')
    assert.equal(query(`SELECT is_active FROM public.evo_store_product_images
      WHERE storage_path='${httpPath}'`),'f','HTTP upload alone never activates gallery image')


  })
}
