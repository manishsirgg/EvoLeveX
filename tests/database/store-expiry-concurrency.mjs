import assert from 'node:assert/strict'
import { psql, query } from './helpers/bootstrap.mjs'

const uuid = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = n => uuid('18', n)
const variant = n => uuid('58', n)
const product = n => uuid('48', n)
const customer = n => `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user(n)}',true);`
const create = (n, pairs) => `public.create_evo_store_checkout('${JSON.stringify(pairs.map(([v, quantity]) => ({ variant_id: variant(v), quantity })))}','USD',gen_random_uuid(),'${uuid('98', n)}')`
const worker = 'public.expire_evo_store_checkouts(25)'
const stock = n => query(`SELECT quantity_on_hand||':'||quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant(n)}'`)
const movements = () => query('SELECT count(*) FROM public.evo_store_inventory_movements')
const elapsed = ids => query(`UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE id IN (${ids.map(id => `'${id}'`).join(',')})`)

async function invoke(role, expression, startAt = new Date().toISOString(), tail = 'COMMIT;') {
  const output = await psql(['-Atq'], `BEGIN; SET LOCAL statement_timeout='10s'; ${role}
    SELECT pg_sleep(greatest(0,extract(epoch FROM '${startAt}'::timestamptz-clock_timestamp())));
    SELECT ${expression}; ${tail}`, { capture: true })
  const json = output.split('\n').find(line => line.startsWith('{'))
  assert.ok(json, 'RPC returns aggregate/checkout JSON')
  return JSON.parse(json)
}
const expire = (at, tail) => invoke('SET LOCAL ROLE service_role;', worker, at, tail)
const hold = (n, pairs) => invoke(customer(n), create(n, pairs))
async function race(requests) {
  const at = new Date(Date.now() + 500).toISOString()
  const results = await Promise.allSettled(requests.map(fn => fn(at)))
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason
  }
  return results.map(result => result.value)
}
async function waitForSession(name, event = 'PgSleep') {
  for (let i = 0; i < 100; i += 1) {
    if (query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${name}' AND state='active' AND wait_event='${event}')`) === 't') return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail(`session ${name} reached ${event}`)
}

export function registerStoreExpiryConcurrency(serialTest) {
  serialTest('Store expiry: concurrent workers release multi-product unions exactly once', async () => {
    await psql(['-1', '-f', new URL('./supabase/tests/fixtures_store_expiry.sql', import.meta.url).pathname])
    const ledger = movements()
    const a = await hold(1, [[9, 1], [3, 2], [1, 2]])
    const b = await hold(2, [[1, 3], [3, 3], [9, 2]])
    elapsed([a.id, b.id])
    const workers = await race([1, 2].map(n => at => invoke(`SELECT pg_advisory_xact_lock(hashtextextended('evo_store_checkout:user:${user(n)}',0)); SET LOCAL ROLE service_role;`, worker, at, 'SELECT pg_sleep(0.2); COMMIT;')))
    assert.equal(workers.reduce((sum, result) => sum + result.expired, 0), 2)
    assert.equal(query(`SELECT count(*) FROM public.evo_store_checkouts WHERE id IN ('${a.id}','${b.id}') AND status='expired'`), '2')
    assert.equal(stock(1), '1000:0'); assert.equal(stock(3), '1000:0'); assert.equal(stock(9), '1000:0')
    assert.equal((await expire()).expired, 0)
    assert.equal(movements(), ledger)
  })

  serialTest('Store expiry: customer release and lazy replacement serialize with worker', async () => {
    const ledger = movements()
    const a = await hold(1, [[1, 2]])
    elapsed([a.id])
    await race([at => expire(at), at => invoke(customer(1), `public.release_evo_store_checkout('${a.id}')`, at)])
    assert.match(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${a.id}'`), /^(expired|released)$/)
    assert.equal(stock(1), '1000:0')
    const old = await hold(1, [[1, 2], [3, 1]])
    elapsed([old.id])
    const [, fresh] = await race([at => expire(at), at => invoke(customer(1), create(1, [[3, 2], [1, 3]]), at)])
    assert.equal(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${old.id}'`), 'expired')
    assert.equal(stock(1), '1000:3'); assert.equal(stock(3), '1000:2')
    assert.equal(fresh.status, 'active')
    assert.equal((await expire()).expired, 0, 'valid new checkout untouched')
    await invoke(customer(1), `public.release_evo_store_checkout('${fresh.id}')`)
    assert.equal(movements(), ledger)
  })

  serialTest('Store expiry: new customer reservation shares stock with worker', async () => {
    const old = await hold(1, [[1, 2]])
    elapsed([old.id])
    const [, fresh] = await race([at => expire(at), at => invoke(customer(2), create(2, [[1, 4]]), at)])
    assert.equal(stock(1), '1000:4')
    assert.equal(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${old.id}'`), 'expired')
    await invoke(customer(2), `public.release_evo_store_checkout('${fresh.id}')`)
  })

  serialTest('Store expiry: staff adjustment serializes without reservation movement', async () => {
    const held = await hold(1, [[4, 2]])
    elapsed([held.id])
    const ledger = Number(movements())
    const staff = `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);`
    const at = new Date(Date.now() + 500).toISOString()
    const adjusted = psql([], `BEGIN; SET LOCAL statement_timeout='10s'; ${staff}
      SELECT pg_sleep(greatest(0,extract(epoch FROM '${at}'::timestamptz-clock_timestamp())));
      SELECT public.adjust_evo_store_inventory('${variant(4)}','adjust',3,'stock_received'); COMMIT;`, { capture: true })
    await Promise.all([expire(at), adjusted])
    assert.equal(stock(4), '1003:0')
    assert.equal(Number(movements()), ledger + 1, 'only staff stock adjustment authors a movement')
  })

  serialTest('Store expiry: archival and worker both lock orders preserve archived guards', async () => {
    const ledger = movements()
    const held = await hold(1, [[5, 2]])
    elapsed([held.id])
    const archiveFirst = psql([], `BEGIN; SET LOCAL application_name='expiry_archive_first';
      UPDATE public.evo_store_products SET publication_status='archived' WHERE id='${product(5)}';
      SELECT pg_sleep(2); COMMIT;`, { capture: true })
    await waitForSession('expiry_archive_first')
    await Promise.all([archiveFirst, expire()])
    assert.equal(stock(5), '1000:0')
    const other = await hold(1, [[6, 2]])
    elapsed([other.id])
    const workerFirst = invoke("SET LOCAL application_name='expiry_worker_first'; SET LOCAL ROLE service_role;", worker,
      new Date().toISOString(), 'SELECT pg_sleep(2); COMMIT;')
    await waitForSession('expiry_worker_first')
    await Promise.all([workerFirst, psql([], `UPDATE public.evo_store_products SET publication_status='archived' WHERE id='${product(6)}'`, { capture: true })])
    assert.equal(stock(6), '1000:0')
    await assert.rejects(psql([], `UPDATE public.evo_store_inventory SET quantity_on_hand=999 WHERE variant_id='${variant(6)}'`, { capture: true }), /EVO_STORE_INVENTORY_ARCHIVED_PRODUCT/)
    assert.equal(movements(), ledger)
  })

  serialTest('Store expiry: failed savepoint retains outer inventory locks and permits healthy progress', async () => {
    const corrupt = await hold(1, [[2, 2], [3, 2]])
    const healthy = await hold(2, [[7, 3]])
    elapsed([corrupt.id, healthy.id])
    query(`UPDATE public.evo_store_inventory SET quantity_reserved=1 WHERE variant_id='${variant(3)}'`)
    const pending = invoke("SET LOCAL application_name='expiry_corrupt_outer'; SET LOCAL ROLE service_role;", worker,
      new Date().toISOString(), 'SELECT pg_sleep(2); COMMIT;')
    await waitForSession('expiry_corrupt_outer')
    const adjustment = psql([], `BEGIN; SET LOCAL application_name='expiry_after_failed_savepoint'; SET LOCAL statement_timeout='10s';
      SELECT variant_id FROM public.evo_store_inventory WHERE variant_id='${variant(2)}' FOR UPDATE; COMMIT;`, { capture: true })
    await waitForSession('expiry_after_failed_savepoint', 'transactionid')
    const [result] = await Promise.all([pending, adjustment])
    assert.equal(result.expired, 1); assert.equal(result.reconciliation_failed, 1)
    assert.equal(stock(2), '1000:2'); assert.equal(stock(3), '1000:1'); assert.equal(stock(7), '1000:0')
    assert.equal(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${corrupt.id}'`), 'active')
    assert.equal((await expire()).examined, 0, 'failed checkout deferred')
    query(`UPDATE public.evo_store_inventory SET quantity_reserved=2 WHERE variant_id='${variant(3)}';
      UPDATE private.evo_store_checkout_expiry_failures SET last_failed_at=now()-interval '2 minutes',retry_after=now()-interval '1 minute'`)
    assert.equal((await expire()).expired, 1)
    assert.equal(stock(2), '1000:0'); assert.equal(stock(3), '1000:0')
    assert.equal(query('SELECT count(*) FROM private.evo_store_checkout_expiry_failures'), '0')
  })

  serialTest('Store expiry: caller rollback undoes both release and failure records, then retries', async () => {
    const a = await hold(1, [[2, 2]])
    const b = await hold(2, [[7, 2]])
    elapsed([a.id, b.id])
    query(`UPDATE public.evo_store_inventory SET quantity_reserved=1 WHERE variant_id='${variant(2)}'`)
    const result = await expire(undefined, 'ROLLBACK;')
    assert.equal(result.expired, 1); assert.equal(result.reconciliation_failed, 1)
    assert.equal(stock(7), '1000:2')
    assert.equal(query('SELECT count(*) FROM private.evo_store_checkout_expiry_failures'), '0')
    query(`UPDATE public.evo_store_inventory SET quantity_reserved=2 WHERE variant_id='${variant(2)}'`)
    assert.equal((await expire()).expired, 2)
    assert.equal(stock(2), '1000:0'); assert.equal(stock(7), '1000:0')
  })

  serialTest('Store expiry: locked header skipped without waiting even when user advisory is free', async () => {
    const held = await hold(1, [[1, 2]])
    elapsed([held.id])
    const blocker = psql([], `BEGIN; SET LOCAL application_name='expiry_header_blocker'; SELECT id FROM public.evo_store_checkouts WHERE id='${held.id}' FOR UPDATE; SELECT pg_sleep(2); COMMIT;`, { capture: true })
    await waitForSession('expiry_header_blocker')
    const result = await expire()
    assert.equal(result.expired, 0); assert.equal(result.busy, 1)
    assert.equal(stock(1), '1000:2')
    await blocker
    assert.equal((await expire()).expired, 1)
  })

  serialTest('Store expiry: 100 busy candidates bound examination, then bounded batches progress', async () => {
    await psql([], `BEGIN; DO $$ DECLARE n integer; BEGIN FOR n IN 10..119 LOOP
      PERFORM set_config('request.jwt.claim.sub','18000000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
      PERFORM public.create_evo_store_checkout('[{"variant_id":"${variant(1)}","quantity":1}]','USD',gen_random_uuid(),('98000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid);
      END LOOP; END $$;
      UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second'
        WHERE user_id BETWEEN '${user(10)}' AND '${user(119)}'; COMMIT;`)
    const blocker = psql([], `BEGIN; SET LOCAL application_name='expiry_100_users';
      SELECT pg_advisory_xact_lock(hashtextextended('evo_store_checkout:user:'||('18000000-0000-4000-8000-'||lpad(n::text,12,'0')),0)) FROM generate_series(10,109) n;
      SELECT pg_sleep(2); COMMIT;`, { capture: true })
    await waitForSession('expiry_100_users')
    const capped = await expire()
    assert.equal(capped.examined, 100); assert.equal(capped.busy, 100); assert.equal(capped.claimed, 0)
    assert.equal(capped.scan_limit_reached, true)
    assert.equal(stock(1), '1000:110', 'candidate 101 untouched')
    await blocker
    const ledger = movements()
    let released = 0
    for (let i = 0; i < 5; i += 1) {
      const result = await expire()
      assert.ok(result.claimed <= 25 && result.examined <= 100)
      released += result.expired
    }
    assert.equal(released, 110)
    assert.equal(stock(1), '1000:0')
    assert.equal(movements(), ledger)
  })
}
