import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'

import { bootstrapDatabase, psql, query } from './helpers/bootstrap.mjs'
import { LOCAL_DATABASE, LOCAL_DATABASE_URL, validateDisposableTarget } from './helpers/local-target.mjs'
import { run } from './helpers/process.mjs'

const root = new URL('../..', import.meta.url)
const sql = name => new URL(`./supabase/tests/${name}`, import.meta.url)
const auth = `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',false);`

before(async () => {
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  await run('supabase', ['start', '--workdir', 'tests/database'], { cwd: root })
  await bootstrapDatabase()
})

after(async () => {
  // Validation is repeated before teardown; no user-controlled project or URL is accepted.
  validateDisposableTarget(LOCAL_DATABASE_URL, LOCAL_DATABASE.projectId)
  await run('supabase', ['stop', '--workdir', 'tests/database', '--no-backup'], { cwd: root })
})

for (const name of ['001_catalog.sql', '002_behavior.sql', '003_lifecycle.sql']) {
  test(`pgTAP ${name}`, async () => {
    const output = await psql(['-Aqt', '-f', new URL(`./supabase/tests/${name}`, import.meta.url).pathname], undefined, { capture: true })
    assert.match(output, /1\.\.[0-9]+/)
    assert.doesNotMatch(output, /^not ok\b/m)
  })
}

test('concurrent commerce operations serialize to canonical outcomes', async () => {
  await psql(['-f', sql('fixtures_concurrency.sql').pathname])

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

test('expiry and provider attachment race never orphan the synthetic provider order', async () => {
  const setup = `${auth} SELECT * FROM create_pending_evo_vault_order('42000000-0000-4000-8000-000000000002','USD');`
  await psql([], setup)
  const orderId = query("SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.vault_product_id='42000000-0000-4000-8000-000000000002'")
  await psql([], `${auth} SELECT * FROM reserve_razorpay_payment('${orderId}')`)
  query(`UPDATE orders SET checkout_expires_at=now()-interval '1 second' WHERE id='${orderId}'`)
  const paymentId = query(`SELECT id FROM payments WHERE order_id='${orderId}'`)
  await Promise.all([
    psql([], `SET ROLE service_role; SELECT expire_pending_evo_vault_checkouts(100)`),
    psql([], `${auth} SELECT * FROM attach_razorpay_order('${paymentId}','order_SYNTHETIC3001')`),
  ])
  assert.equal(query(`SELECT provider_order_id FROM payments WHERE id='${paymentId}'`), 'order_SYNTHETIC3001')
  assert.equal(query(`SELECT status::text||':'||payment_status::text FROM orders WHERE id='${orderId}'`), 'cancelled:failed')
})

test('capture reconciliation races expiry and duplicate deliveries idempotently', async () => {
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
  assert.equal(query(`SELECT refunded_amount::text FROM payments WHERE id='${paymentId}'`), '25.00')
})

test('baseline and test SQL contain synthetic provider identifiers only', async () => {
  const sources = await Promise.all(['002_behavior.sql','003_lifecycle.sql','fixtures_concurrency.sql']
    .map(name => readFile(sql(name), 'utf8')))
  for (const source of sources) {
    assert.doesNotMatch(source, /rzp_(?:live|test)_|api\.razorpay\.com|https?:\/\//i)
    for (const [, id] of source.matchAll(/'((?:order|pay|rfnd|evt)_[A-Za-z0-9_]+)'/g)) {
      assert.match(id, /SYNTHETIC/)
    }
  }
})
