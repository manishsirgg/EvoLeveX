import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'

import { registerCompatibleStoreDeployment } from './compatible-store-deployment.mjs'

import { registerAtomicStoreDeployment } from './atomic-store-deployment.mjs'

import { registerInventoryGuardRepair } from './inventory-guard-repair.mjs'

import { registerStoreExpiryConcurrency } from './store-expiry-concurrency.mjs'

import { registerStoreCheckoutConcurrency } from './store-checkout-concurrency.mjs'

import { bootstrapDatabase, bootstrapPreInventoryDatabase, psql, query } from './helpers/bootstrap.mjs'
import { LOCAL_DATABASE, LOCAL_DATABASE_URL, validateDisposableTarget } from './helpers/local-target.mjs'
import { run } from './helpers/process.mjs'

const root = new URL('../..', import.meta.url)
const sql = name => new URL(`./supabase/tests/${name}`, import.meta.url)
const auth = `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',false);`
const serialTest = (name, fn) => test(name, { concurrency: false }, fn)

before(async () => {
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  await run('supabase', ['start', '--workdir', 'tests/database'], { cwd: root })
  await bootstrapPreInventoryDatabase()
  // Catalog management installs the earlier adjustment implementation.
  // Remove it only on the guarded disposable target to model confirmed drift.
  await psql([], 'DROP FUNCTION public.adjust_evo_store_inventory(uuid,text,integer,text);')
  await psql([], 'CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions')
})

after(async () => {
  // Validation is repeated before teardown; no user-controlled project or URL is accepted.
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  await run('supabase', ['stop', '--workdir', 'tests/database', '--no-backup'], { cwd: root })
})

async function resetDisposable(preInventory) {
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  await run('supabase', ['stop', '--workdir', 'tests/database', '--no-backup'], { cwd: root })
  await run('supabase', ['start', '--workdir', 'tests/database'], { cwd: root })
  if (preInventory) {
    await bootstrapPreInventoryDatabase()
    await psql([], 'DROP FUNCTION public.adjust_evo_store_inventory(uuid,text,integer,text); CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;')
  } else await bootstrapDatabase()
}

registerCompatibleStoreDeployment(serialTest, { psql, query, resetPreInventory: () => resetDisposable(true) })
registerAtomicStoreDeployment(serialTest, { psql, query, bootstrapDatabase: () => resetDisposable(false) })

for (const name of ['001_catalog.sql', '002_behavior.sql', '003_lifecycle.sql', '004_store_catalog.sql', '005_store_catalog_management.sql', '006_store_product_images.sql', '007_store_product_variants.sql', '008_store_variant_prices.sql', '009_store_inventory.sql', '010_store_checkout_foundation.sql', '011_store_checkout_reservations.sql', '012_store_checkout_expiry.sql']) {
  serialTest(`pgTAP ${name}`, async () => {
    if (name === '012_store_checkout_expiry.sql') {
      // Preserve the Phase 2J-B no-global-expiry assertion against its exact
      // schema, then execute the forward migration before Phase 2J-C tests.
      await psql([], await readFile(new URL('../../supabase/migrations/20261008125840_evo_store_checkout_expiry_worker.sql', import.meta.url), 'utf8'))
    }
    const output = await psql(['-Aqt', '-f', new URL(`./supabase/tests/${name}`, import.meta.url).pathname], undefined, { capture: true })
    assert.match(output, /1\.\.[0-9]+/)
    console.info(`${name}: ${output.match(/1\.\.([0-9]+)/)[1]} pgTAP assertions`)
    assert.doesNotMatch(output, /^not ok\b/m)
  })
}

registerInventoryGuardRepair(serialTest, { psql, query })

serialTest('Store price mutation and archival serialize on product rows', async () => {
  await psql(['-f', sql('fixtures_concurrency.sql').pathname])

  const mutationFirst = psql([], `BEGIN;
    UPDATE public.evo_store_variant_prices SET amount=11
    WHERE id='72000000-0000-4000-8000-000000000001';
    SELECT pg_sleep(1);
    COMMIT;`)
  await new Promise(resolve => setTimeout(resolve, 150))
  const archivalAfterMutation = psql([], `UPDATE public.evo_store_products SET publication_status='archived'
    WHERE id='42000000-0000-4000-8000-000000000101'`)
  await Promise.all([mutationFirst, archivalAfterMutation])
  assert.equal(query("SELECT publication_status::text||':'||amount::text FROM public.evo_store_products product JOIN public.evo_store_variants variant ON variant.product_id=product.id JOIN public.evo_store_variant_prices price ON price.variant_id=variant.id WHERE product.id='42000000-0000-4000-8000-000000000101'"), 'archived:11.00')

  const archivalFirst = psql([], `BEGIN;
    UPDATE public.evo_store_products SET publication_status='archived'
    WHERE id='42000000-0000-4000-8000-000000000102';
    SELECT pg_sleep(1);
    COMMIT;`)
  await new Promise(resolve => setTimeout(resolve, 150))
  const mutationAfterArchival = psql([], `UPDATE public.evo_store_variant_prices SET amount=12
    WHERE id='72000000-0000-4000-8000-000000000002'`, { capture: true })
  const [, rejectedMutation] = await Promise.allSettled([archivalFirst, mutationAfterArchival])
  assert.equal(rejectedMutation.status, 'rejected')
  assert.match(rejectedMutation.reason.message, /EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT/)
  assert.equal(query("SELECT publication_status::text FROM public.evo_store_products WHERE id='42000000-0000-4000-8000-000000000102'"), 'archived')
  assert.equal(query("SELECT amount::text FROM public.evo_store_variant_prices WHERE id='72000000-0000-4000-8000-000000000002'"), '10.00')
})

serialTest('opposite cross-product price moves use a deadlock-free lock order', async () => {
  const startAt = new Date(Date.now() + 1000).toISOString()
  const moves = await Promise.allSettled([
    psql([], `BEGIN;
      SELECT 1 FROM public.evo_store_variant_prices WHERE id='72000000-0000-4000-8000-000000000003' FOR UPDATE;
      SELECT pg_sleep(greatest(0, extract(epoch FROM '${startAt}'::timestamptz - clock_timestamp())));
      UPDATE public.evo_store_variant_prices SET variant_id='52000000-0000-4000-8000-000000000104'
      WHERE id='72000000-0000-4000-8000-000000000003';
      COMMIT;`, { capture: true }),
    psql([], `BEGIN;
      SELECT 1 FROM public.evo_store_variant_prices WHERE id='72000000-0000-4000-8000-000000000004' FOR UPDATE;
      SELECT pg_sleep(greatest(0, extract(epoch FROM '${startAt}'::timestamptz - clock_timestamp())));
      UPDATE public.evo_store_variant_prices SET variant_id='52000000-0000-4000-8000-000000000103'
      WHERE id='72000000-0000-4000-8000-000000000004';
      COMMIT;`, { capture: true }),
  ])
  assert.ok(moves.every(result => result.status === 'fulfilled'))
  assert.equal(query("SELECT count(*) FROM public.evo_store_variant_prices WHERE id IN ('72000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000004')"), '2')
})

serialTest('Store inventory mutation and archival serialize on product rows', async () => {
  const mutationFirst = psql([], `BEGIN; ${auth}
    SELECT * FROM public.adjust_evo_store_inventory('52000000-0000-4000-8000-000000000105','adjust',5,'stock_received');
    SELECT pg_sleep(1); COMMIT;`)
  await new Promise(resolve => setTimeout(resolve, 150))
  const archivalAfterMutation = psql([], `UPDATE public.evo_store_products SET publication_status='archived'
    WHERE id='42000000-0000-4000-8000-000000000105'`)
  await Promise.all([mutationFirst, archivalAfterMutation])
  assert.equal(query("SELECT publication_status::text||':'||quantity_on_hand FROM public.evo_store_products p JOIN public.evo_store_variants v ON v.product_id=p.id JOIN public.evo_store_inventory i ON i.variant_id=v.id WHERE p.id='42000000-0000-4000-8000-000000000105'"), 'archived:25')

  const beforeMovements = query("SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='52000000-0000-4000-8000-000000000106'")
  const archivalFirst = psql([], `BEGIN; UPDATE public.evo_store_products SET publication_status='archived'
    WHERE id='42000000-0000-4000-8000-000000000106'; SELECT pg_sleep(1); COMMIT;`)
  await new Promise(resolve => setTimeout(resolve, 150))
  const rejected = psql([], `${auth} SELECT * FROM public.adjust_evo_store_inventory(
    '52000000-0000-4000-8000-000000000106','adjust',5,'stock_received')`, { capture: true })
  const [, mutationResult] = await Promise.allSettled([archivalFirst, rejected])
  assert.equal(mutationResult.status, 'rejected')
  assert.match(mutationResult.reason.message, /EVO_STORE_INVENTORY_ARCHIVED_PRODUCT/)
  assert.equal(query("SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='52000000-0000-4000-8000-000000000106'"), '20')
  assert.equal(query("SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='52000000-0000-4000-8000-000000000106'"), beforeMovements)
})

serialTest('concurrent inventory adjustments preserve every valid effect', async () => {
  const adjust = (variant, quantity, reason = quantity > 0 ? 'stock_received' : 'loss') =>
    psql([], `${auth} SELECT * FROM public.adjust_evo_store_inventory('${variant}','adjust',${quantity},'${reason}')`, { capture: true })

  await Promise.all([
    adjust('52000000-0000-4000-8000-000000000107', 5),
    adjust('52000000-0000-4000-8000-000000000107', 7),
  ])
  assert.equal(query("SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='52000000-0000-4000-8000-000000000107'"), '32')

  await Promise.all([
    adjust('52000000-0000-4000-8000-000000000108', -3),
    adjust('52000000-0000-4000-8000-000000000108', -4),
  ])
  assert.equal(query("SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='52000000-0000-4000-8000-000000000108'"), '3')

  const overdraw = await Promise.allSettled([
    adjust('52000000-0000-4000-8000-000000000109', -7),
    adjust('52000000-0000-4000-8000-000000000109', -7),
  ])
  assert.equal(overdraw.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(query("SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='52000000-0000-4000-8000-000000000109'"), '3')
  assert.equal(query("SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='52000000-0000-4000-8000-000000000109'"), '1')

  await Promise.all([
    adjust('52000000-0000-4000-8000-000000000110', 9),
    adjust('52000000-0000-4000-8000-000000000110', -6),
  ])
  assert.equal(query("SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='52000000-0000-4000-8000-000000000110'"), '23')
})

serialTest('inventory initialization is unique and lifecycle locking does not deadlock', async () => {
  const initialize = `${auth} SELECT * FROM public.adjust_evo_store_inventory(
    '52000000-0000-4000-8000-000000000113','initialize',8,'initial_stock')`
  const initialized = await Promise.allSettled([psql([], initialize, { capture: true }), psql([], initialize, { capture: true })])
  assert.equal(initialized.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(query("SELECT count(*)||':'||max(quantity_on_hand) FROM public.evo_store_inventory WHERE variant_id='52000000-0000-4000-8000-000000000113'"), '1:8')
  assert.equal(query("SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='52000000-0000-4000-8000-000000000113'"), '1')

  const startAt = new Date(Date.now() + 1000).toISOString()
  const lifecycle = await Promise.allSettled([
    psql([], `${auth} SELECT pg_sleep(greatest(0, extract(epoch FROM '${startAt}'::timestamptz-clock_timestamp())));
      SELECT * FROM public.adjust_evo_store_inventory('52000000-0000-4000-8000-000000000112','adjust',2,'stock_received')`, { capture: true }),
    psql([], `SELECT pg_sleep(greatest(0, extract(epoch FROM '${startAt}'::timestamptz-clock_timestamp())));
      UPDATE public.evo_store_variants SET name='Lifecycle Updated' WHERE id='52000000-0000-4000-8000-000000000112'`, { capture: true }),
  ])
  assert.ok(lifecycle.every(result => result.status === 'fulfilled'))
  assert.equal(query("SELECT name||':'||quantity_on_hand FROM public.evo_store_variants v JOIN public.evo_store_inventory i ON i.variant_id=v.id WHERE v.id='52000000-0000-4000-8000-000000000112'"), 'Lifecycle Updated:22')
})

serialTest('inventory integer overflow is transactionally clean', async () => {
  query("UPDATE public.evo_store_inventory SET quantity_on_hand=2147483647 WHERE variant_id='52000000-0000-4000-8000-000000000111'")
  const before = query("SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='52000000-0000-4000-8000-000000000111'")
  const result = await Promise.allSettled([psql([], `${auth} SELECT * FROM public.adjust_evo_store_inventory(
    '52000000-0000-4000-8000-000000000111','adjust',1,'stock_received')`, { capture: true })])
  assert.equal(result[0].status, 'rejected')
  assert.match(result[0].reason.message, /22003|integer out of range/i)
  assert.equal(query("SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='52000000-0000-4000-8000-000000000111'"), '2147483647')
  assert.equal(query("SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='52000000-0000-4000-8000-000000000111'"), before)
})

serialTest('concurrent commerce operations serialize to canonical outcomes', async () => {
  const checkout = `${auth} SELECT * FROM public.create_pending_evo_vault_order('42000000-0000-4000-8000-000000000001','USD');`
  await Promise.all([psql([], checkout), psql([], checkout)])
  assert.equal(query("SELECT count(*) FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.vault_product_id='42000000-0000-4000-8000-000000000001'"), '1')

  const orderId = query("SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.vault_product_id='42000000-0000-4000-8000-000000000001'")
  await Promise.all([psql([], `${auth} SELECT * FROM reserve_razorpay_payment('${orderId}')`), psql([], `${auth} SELECT * FROM reserve_razorpay_payment('${orderId}')`)])
  assert.equal(query(`SELECT count(*) FROM payments WHERE order_id='${orderId}'`), '1')

  const paymentId = query(`SELECT id FROM payments WHERE order_id='${orderId}'`)
  const attached = await Promise.allSettled([
    psql([], `${auth} SELECT * FROM attach_razorpay_order('${paymentId}','order_SYNTHETIC2001')`),
    psql([], `${auth} SELECT * FROM attach_razorpay_order('${paymentId}','order_SYNTHETIC2002')`),
  ])
  assert.equal(attached.filter(result => result.status === 'fulfilled').length, 1)
  assert.match(query(`SELECT provider_order_id FROM payments WHERE id='${paymentId}'`), /^order_SYNTHETIC200[12]$/)

  // Fulfillment is deliberately raced after constructing a valid confirmed payment.
  query(`UPDATE payments SET status='paid',provider_payment_id='pay_SYNTHETIC2001',paid_at=now() WHERE id='${paymentId}'; UPDATE orders SET status='confirmed',payment_status='paid',confirmed_at=now() WHERE id='${orderId}'`)
  const fulfill = `SET ROLE service_role; SELECT fulfill_confirmed_evo_vault_order('${orderId}')`
  await Promise.all([psql([], fulfill), psql([], fulfill)])
  assert.equal(query("SELECT count(*) FROM digital_access WHERE user_id='12000000-0000-4000-8000-000000000001' AND vault_product_id='42000000-0000-4000-8000-000000000001'"), '1')
})

serialTest('expiry and provider attachment race never orphan the synthetic provider order', async () => {
  const setup = `${auth} SELECT * FROM create_pending_evo_vault_order('42000000-0000-4000-8000-000000000002','USD');`
  await psql([], setup)
  const orderId = query("SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.vault_product_id='42000000-0000-4000-8000-000000000002'")
  await psql([], `${auth} SELECT * FROM reserve_razorpay_payment('${orderId}')`)
  query(`UPDATE orders SET checkout_expires_at=now()-interval '1 second' WHERE id='${orderId}'`)
  const paymentId = query(`SELECT id FROM payments WHERE order_id='${orderId}'`)
  const raceCommands = [
    `SET ROLE service_role; SELECT expire_pending_evo_vault_checkouts(100)`,
    `${auth} SELECT * FROM attach_razorpay_order('${paymentId}','order_SYNTHETIC3001')`,
  ]
  const raced = await Promise.allSettled(raceCommands.map(command => psql([], command, { capture: true })))
  assert.ok(raced.some(result => result.status === 'fulfilled'))
  for (const [index, result] of raced.entries()) {
    if (result.status === 'rejected') await psql([], raceCommands[index])
  }
  assert.equal(query(`SELECT provider_order_id FROM payments WHERE id='${paymentId}'`), 'order_SYNTHETIC3001')
  assert.equal(query(`SELECT status::text||':'||payment_status::text FROM orders WHERE id='${orderId}'`), 'cancelled:failed')
})

serialTest('capture reconciliation races expiry and duplicate deliveries idempotently', async () => {
  await psql([], `${auth} SELECT * FROM create_pending_evo_vault_order('42000000-0000-4000-8000-000000000003','USD')`)
  const orderId = query("SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.vault_product_id='42000000-0000-4000-8000-000000000003'")
  await psql([], `${auth} SELECT * FROM reserve_razorpay_payment('${orderId}')`)
  const paymentId = query(`SELECT id FROM payments WHERE order_id='${orderId}'`)
  await psql([], `${auth} SELECT * FROM attach_razorpay_order('${paymentId}','order_SYNTHETIC4001')`)
  await psql([], `SET ROLE service_role; SELECT * FROM begin_razorpay_webhook_event('evt_SYNTHETIC_CAPTURE4','payment.captured','{}','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','order_SYNTHETIC4001','pay_SYNTHETIC4001')`)
  query(`UPDATE orders SET checkout_expires_at=now()-interval '1 second' WHERE id='${orderId}'`)
  const reconcile = `SET ROLE service_role; SELECT * FROM reconcile_captured_razorpay_payment('evt_SYNTHETIC_CAPTURE4','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','order_SYNTHETIC4001','pay_SYNTHETIC4001',10000,'USD')`
  const results = await Promise.allSettled([
    psql([], `SET ROLE service_role; SELECT expire_pending_evo_vault_checkouts(100)`),
    psql([], reconcile), psql([], reconcile),
  ])
  assert.ok(results.some(result => result.status === 'fulfilled'))
  // If expiry wins, the explicit recovery RPC is the supported convergence path.
  if (query(`SELECT status::text FROM payments WHERE id='${paymentId}'`) === 'failed') {
    await psql([], `SET ROLE service_role; SELECT * FROM recover_expired_captured_razorpay_payment('${paymentId}','order_SYNTHETIC4001','pay_SYNTHETIC4001',10000,'USD')`)
  }
  assert.equal(query(`SELECT status::text FROM payments WHERE id='${paymentId}'`), 'paid')
  assert.equal(query(`SELECT count(*) FROM digital_access WHERE order_item_id=(SELECT id FROM order_items WHERE order_id='${orderId}')`), '1')

  await Promise.all([
    psql([], `SET ROLE service_role; SELECT * FROM begin_razorpay_refund_webhook_event('evt_SYNTHETIC_REFUND4A','{}','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','pay_SYNTHETIC4001','rfnd_SYNTHETIC4001')`),
    psql([], `SET ROLE service_role; SELECT * FROM begin_razorpay_refund_webhook_event('evt_SYNTHETIC_REFUND4B','{}','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','pay_SYNTHETIC4001','rfnd_SYNTHETIC4001')`),
  ])
  const refunds = await Promise.allSettled([
    psql([], `SET ROLE service_role; SELECT * FROM reconcile_processed_razorpay_refund('evt_SYNTHETIC_REFUND4A','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','rfnd_SYNTHETIC4001','pay_SYNTHETIC4001',2500,'USD',now())`),
    psql([], `SET ROLE service_role; SELECT * FROM reconcile_processed_razorpay_refund('evt_SYNTHETIC_REFUND4B','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','rfnd_SYNTHETIC4001','pay_SYNTHETIC4001',2500,'USD',now())`),
  ])
  assert.ok(refunds.some(result => result.status === 'fulfilled'))
  assert.equal(query("SELECT count(*) FROM payment_refunds WHERE provider_refund_id='rfnd_SYNTHETIC4001'"), '1')
  assert.equal(Number(query(`SELECT refunded_amount FROM payments WHERE id='${paymentId}'`)), 25)
})

serialTest('concurrent failed captured-receipt recovery converges without duplicate entitlement', async () => {
  await psql([], `${auth} SELECT * FROM create_pending_evo_vault_order('42000000-0000-4000-8000-000000000005','USD')`)
  const orderId = query("SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.vault_product_id='42000000-0000-4000-8000-000000000005'")
  await psql([], `${auth} SELECT * FROM reserve_razorpay_payment('${orderId}')`)
  const paymentId = query(`SELECT id FROM payments WHERE order_id='${orderId}'`)
  await psql([], `${auth} SELECT * FROM attach_razorpay_order('${paymentId}','order_SYNTHETIC5001')`)

  const eventId = 'evt_SYNTHETIC_RECOVERY5'
  const payloadHash = '9999999999999999999999999999999999999999999999999999999999999999'
  const payload = `'{"event":"payment.captured","synthetic":true}'`
  const begin = `SELECT * FROM begin_razorpay_webhook_event('${eventId}','payment.captured',${payload},'${payloadHash}','order_SYNTHETIC5001','pay_SYNTHETIC5001')`
  await psql([], `SET ROLE service_role; ${begin}; SELECT fail_razorpay_webhook_event('${eventId}','${payloadHash}','synthetic_concurrent_retry')`)
  assert.equal(query(`SELECT processing_status||':'||attempt_count||':'||safe_error_code FROM payment_webhook_events WHERE provider_event_id='${eventId}'`), 'failed:1:synthetic_concurrent_retry')
  const initialAttemptedAt = query(`SELECT extract(epoch FROM last_attempted_at)::text FROM payment_webhook_events WHERE provider_event_id='${eventId}'`)

  const attempt = `SET ROLE service_role; ${begin}; SELECT * FROM reconcile_captured_razorpay_payment('${eventId}','${payloadHash}','order_SYNTHETIC5001','pay_SYNTHETIC5001',10000,'USD')`
  const results = await Promise.allSettled([psql([], attempt), psql([], attempt)])
  assert.ok(results.every(result => result.status === 'fulfilled'))

  assert.equal(query(`SELECT status::text FROM payments WHERE id='${paymentId}'`), 'paid')
  assert.equal(query(`SELECT status::text||':'||payment_status::text FROM orders WHERE id='${orderId}'`), 'confirmed:paid')
  assert.equal(query(`SELECT count(*) FROM payments WHERE id='${paymentId}' AND provider_order_id='order_SYNTHETIC5001' AND provider_payment_id='pay_SYNTHETIC5001'`), '1')
  assert.equal(query(`SELECT count(*) FROM digital_access WHERE order_item_id=(SELECT id FROM order_items WHERE order_id='${orderId}') AND status='active'`), '1')
  assert.equal(query(`SELECT processing_status||':'||(processed_at IS NOT NULL)::text||':'||(safe_error_code IS NULL)::text FROM payment_webhook_events WHERE provider_event_id='${eventId}'`), 'processed:true:true')
  assert.match(query(`SELECT attempt_count::text FROM payment_webhook_events WHERE provider_event_id='${eventId}'`), /^[23]$/)
  assert.ok(Number(query(`SELECT extract(epoch FROM last_attempted_at) FROM payment_webhook_events WHERE provider_event_id='${eventId}'`)) > Number(initialAttemptedAt))
  assert.equal(query(`SELECT count(*) FROM payment_webhook_events WHERE provider='razorpay' AND provider_event_id='${eventId}' AND event_type='payment.captured' AND payload_sha256='${payloadHash}' AND provider_order_id='order_SYNTHETIC5001' AND provider_payment_id='pay_SYNTHETIC5001'`), '1')
})

serialTest('baseline and test SQL contain synthetic provider identifiers only', async () => {
  const sources = await Promise.all(['002_behavior.sql','003_lifecycle.sql','fixtures_concurrency.sql']
    .map(name => readFile(sql(name), 'utf8')))
  for (const source of sources) {
    assert.doesNotMatch(source, /rzp_(?:live|test)_|api\.razorpay\.com|https?:\/\//i)
    for (const [, id] of source.matchAll(/'((?:order|pay|rfnd|evt)_[A-Za-z0-9_]+)'/g)) {
      assert.match(id, /SYNTHETIC/)
    }
  }
})

registerStoreCheckoutConcurrency(serialTest)

registerStoreExpiryConcurrency(serialTest)

serialTest('Store category hierarchy enforces two levels and leaf-only products', async () => {
  const migration = await readFile(new URL('../../supabase/migrations/20261009020000_evo_store_category_hierarchy.sql', import.meta.url), 'utf8')
  await psql([], migration)
  const root = '38000000-0000-4000-8000-000000000001'
  const child = '38000000-0000-4000-8000-000000000002'
  const grandchild = '38000000-0000-4000-8000-000000000003'
  await psql([], `INSERT INTO public.evo_store_categories(id,name,slug) VALUES
    ('${root}','Fashion','test-hierarchy-fashion'),
    ('${child}','T-Shirts','test-hierarchy-t-shirts');
    UPDATE public.evo_store_categories SET parent_id='${root}' WHERE id='${child}';`)
  assert.equal(query(`SELECT parent_id::text FROM public.evo_store_categories WHERE id='${child}'`), root)

  await assert.rejects(psql([], `INSERT INTO public.evo_store_categories(id,name,slug,parent_id)
    VALUES ('${grandchild}','Too Deep','test-hierarchy-too-deep','${child}')`, { capture: true }), /EVO_STORE_CATEGORY_MAX_DEPTH/)

  await assert.rejects(psql([], `UPDATE public.evo_store_categories SET parent_id='${child}' WHERE id='${root}'`, { capture: true }), /EVO_STORE_CATEGORY_MAX_DEPTH/)

  await assert.rejects(psql([], `INSERT INTO public.evo_store_products
    (id,category_id,name,slug,product_mode,base_price,currency)
    VALUES ('48000000-0000-4000-8000-000000000001','${root}','Invalid parent product','test-hierarchy-parent-product','physical',10,'USD')`,
    { capture: true }), /EVO_STORE_CATEGORY_PARENT_NOT_ASSIGNABLE/)

  await psql([], `INSERT INTO public.evo_store_products
    (id,category_id,name,slug,product_mode,base_price,currency)
    VALUES ('48000000-0000-4000-8000-000000000002','${child}','Valid child draft','test-hierarchy-child-product','physical',10,'USD')`)
  assert.equal(query(`SELECT category_id::text FROM public.evo_store_products WHERE id='48000000-0000-4000-8000-000000000002'`), child)

  await assert.rejects(psql([], `INSERT INTO public.evo_store_categories
    (name,slug,parent_id) VALUES ('Not nestable','test-hierarchy-nested-product','${child}')`,
    { capture: true }), /EVO_STORE_CATEGORY_MAX_DEPTH/)
})
