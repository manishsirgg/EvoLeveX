import assert from 'node:assert/strict'
import { psql, query } from './helpers/bootstrap.mjs'

const uuid = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = n => uuid('19', n)
const address = n => uuid('99', n)
const variant = n => uuid('59', n)
const key = n => uuid('a9', n)
const items = pairs => JSON.stringify(pairs.map(([n, quantity]) => ({ variant_id: variant(n), quantity })))
const create = (n, pairs, requestKey) => `public.create_evo_store_checkout('${items(pairs)}'::jsonb,'USD','${key(requestKey)}','${address(n)}')`
const role = n => `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user(n)}',true);`

async function invoke(n, expression, startAt = new Date().toISOString()) {
  const output = await psql(['-Atq'], `BEGIN; SET LOCAL statement_timeout='10s'; ${role(n)}
    SELECT pg_sleep(greatest(0,extract(epoch FROM '${startAt}'::timestamptz-clock_timestamp())));
    SELECT ${expression}; SELECT pg_sleep(0.2); COMMIT;`, { capture: true })
  const dto = output.split('\n').find(line => line.startsWith('{'))
  assert.ok(dto, 'RPC emits JSON result')
  return JSON.parse(dto)
}

async function race(requests) {
  const startAt = new Date(Date.now() + 750).toISOString()
  return Promise.allSettled(requests.map(([n, expression]) => invoke(n, expression, startAt)))
}

function assertOneWinner(results, error) {
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const failure = results.find(result => result.status === 'rejected')
  assert.match(failure.reason.message, new RegExp(error))
  assert.doesNotMatch(failure.reason.message, /deadlock detected|statement timeout/i)
  return results.find(result => result.status === 'fulfilled').value
}

function inventory(n) {
  return query(`SELECT quantity_on_hand||':'||quantity_reserved FROM public.evo_store_inventory WHERE variant_id='${variant(n)}'`)
}
async function releaseAll() {
  for (const n of [1, 2]) {
    const ids = query(`SELECT id FROM public.evo_store_checkouts WHERE user_id='${user(n)}' AND status='active'`)
    for (const id of ids.split('\n').filter(Boolean)) await invoke(n, `public.release_evo_store_checkout('${id}')`)
  }
}
const count = table => query(`SELECT count(*) FROM public.${table}`)

export function registerStoreCheckoutConcurrency(serialTest) {
  serialTest('Store reservation separate-session concurrency and atomic rollback', async () => {
    await psql(['-1', '-f', new URL('./supabase/tests/fixtures_store_checkout.sql', import.meta.url).pathname])
    const before = Object.fromEntries(['orders', 'order_items', 'payments', 'digital_access', 'evo_store_inventory_movements'].map(table => [table, count(table)]))

    // A: two customers contend for the actual last unit.
    query(`UPDATE public.evo_store_inventory SET quantity_on_hand=1 WHERE variant_id='${variant(1)}'`)
    assertOneWinner(await race([[1, create(1, [[1, 1]], 1)], [2, create(2, [[1, 1]], 2)]]), 'EVO_STORE_CHECKOUT_OUT_OF_STOCK')
    assert.equal(inventory(1), '1:1')
    await releaseAll()

    // B: same user/key/payload serializes before any hold is authored.
    query(`UPDATE public.evo_store_inventory SET quantity_on_hand=20 WHERE variant_id='${variant(1)}'`)
    const replay = await race([[1, create(1, [[1, 2]], 3)], [1, create(1, [[1, 2]], 3)]])
    assert.ok(replay.every(result => result.status === 'fulfilled'))
    assert.deepEqual(replay[0].value, replay[1].value)
    assert.equal(inventory(1), '20:2')
    assert.equal(query(`SELECT count(*) FROM public.evo_store_checkout_items WHERE checkout_id='${replay[0].value.id}'`), '1')
    await releaseAll()

    // C: simultaneous different payloads with the same key have one canonical result.
    const conflict = assertOneWinner(await race([[1, create(1, [[1, 1]], 4)], [1, create(1, [[1, 2]], 4)]]), 'EVO_STORE_CHECKOUT_IDEMPOTENCY_CONFLICT')
    assert.equal(inventory(1), `20:${conflict.items[0].quantity}`)
    assert.equal(query(`SELECT count(*) FROM public.evo_store_checkouts WHERE user_id='${user(1)}' AND idempotency_key='${key(4)}'`), '1')
    await releaseAll()

    // D: opposing order across distinct parents uses the same ordered lock set.
    query(`UPDATE public.evo_store_inventory SET quantity_on_hand=2 WHERE variant_id IN ('${variant(2)}','${variant(3)}')`)
    assertOneWinner(await race([[1, create(1, [[2, 2], [3, 2]], 5)], [2, create(2, [[3, 2], [2, 2]], 6)]]), 'EVO_STORE_CHECKOUT_OUT_OF_STOCK')
    assert.equal(inventory(2), '2:2')
    assert.equal(inventory(3), '2:2')
    await releaseAll()

    // E: an insufficient second line rolls back the entire request.
    query(`UPDATE public.evo_store_inventory SET quantity_on_hand=0 WHERE variant_id='${variant(4)}'`)
    const headersBefore = count('evo_store_checkouts')
    const linesBefore = count('evo_store_checkout_items')
    await assert.rejects(invoke(1, create(1, [[1, 2], [4, 1]], 7)), /EVO_STORE_CHECKOUT_OUT_OF_STOCK/)
    assert.equal(count('evo_store_checkouts'), headersBefore)
    assert.equal(count('evo_store_checkout_items'), linesBefore)
    assert.equal(inventory(1), '20:0')
    assert.equal(inventory(4), '0:0')

    // F: concurrent releases converge without a second decrement.
    const held = await invoke(1, create(1, [[1, 2]], 8))
    const releases = await race([[1, `public.release_evo_store_checkout('${held.id}')`], [1, `public.release_evo_store_checkout('${held.id}')`]])
    assert.ok(releases.every(result => result.status === 'fulfilled'))
    assert.deepEqual(releases[0].value, releases[1].value)
    assert.equal(releases[0].value.status, 'released')
    assert.equal(inventory(1), '20:0')

    // G: competing new requests lazily expire one elapsed hold exactly once.
    const elapsed = await invoke(1, create(1, [[5, 1]], 9))
    query(`UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE id='${elapsed.id}'`)
    const replacement = await race([[1, create(1, [[5, 2]], 10)], [1, create(1, [[5, 2]], 10)]])
    assert.ok(replacement.every(result => result.status === 'fulfilled'))
    assert.deepEqual(replacement[0].value, replacement[1].value)
    assert.equal(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${elapsed.id}'`), 'expired')
    assert.equal(inventory(5), '20:2')
    await invoke(1, `public.release_evo_store_checkout('${elapsed.id}')`)
    assert.equal(inventory(5), '20:2')

    // H: two distinct keys cannot silently replace a valid active checkout.
    const validId = replacement[0].value.id
    const active = await race([[1, create(1, [[6, 1]], 11)], [1, create(1, [[7, 1]], 12)]])
    assert.ok(active.every(result => result.status === 'rejected' && /EVO_STORE_CHECKOUT_ACTIVE_EXISTS/.test(result.reason.message)))
    assert.equal(query(`SELECT id FROM public.evo_store_checkouts WHERE user_id='${user(1)}' AND status='active'`), validId)
    assert.equal(inventory(5), '20:2')
    await releaseAll()

    // Same user/different keys on an empty lifecycle boundary also serialize.
    assertOneWinner(await race([[1, create(1, [[6, 1]], 13)], [1, create(1, [[7, 1]], 14)]]), 'EVO_STORE_CHECKOUT_ACTIVE_EXISTS')
    await releaseAll()

    // Crossed lazy-expiry requests lock old+new parents as one sorted union.
    const oldA = await invoke(1, create(1, [[6, 1]], 16))
    const oldB = await invoke(2, create(2, [[7, 1]], 17))
    query(`UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE id IN ('${oldA.id}','${oldB.id}')`)
    const crossed = await race([[1, create(1, [[7, 2]], 18)], [2, create(2, [[6, 2]], 19)]])
    assert.ok(crossed.every(result => result.status === 'fulfilled'))
    assert.equal(inventory(6), '20:2')
    assert.equal(inventory(7), '20:2')
    assert.equal(query(`SELECT count(*) FROM public.evo_store_checkouts WHERE id IN ('${oldA.id}','${oldB.id}') AND status='expired'`), '2')
    await releaseAll()

    // Manual release and targeted lazy expiry share the header lifecycle boundary.
    const releaseExpiry = await invoke(1, create(1, [[5, 1]], 20))
    query(`UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE id='${releaseExpiry.id}'`)
    const lifecycle = await race([[1, `public.release_evo_store_checkout('${releaseExpiry.id}')`], [1, create(1, [[5, 2]], 21)]])
    assert.ok(lifecycle.every(result => result.status === 'fulfilled'))
    assert.match(query(`SELECT status::text FROM public.evo_store_checkouts WHERE id='${releaseExpiry.id}'`), /^(released|expired)$/)
    assert.equal(inventory(5), '20:2')
    await releaseAll()

    // An archive that already owns the product lock must win revalidation.
    const archive = psql([], `BEGIN; UPDATE public.evo_store_products SET publication_status='archived'
      WHERE id='${uuid('49', 8)}'; SELECT pg_sleep(1); COMMIT;`, { capture: true })
    // Wait for the lock to be observable, instead of assuming process startup order.
    let observed = false
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (query(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.query LIKE '%SELECT pg_sleep(1); COMMIT;%' AND a.pid<>pg_backend_pid() AND l.locktype='transactionid' AND l.mode='ExclusiveLock')`) === 't') { observed = true; break }
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    assert.ok(observed, 'archival transaction owns its lock')
    const rejected = invoke(2, create(2, [[8, 1]], 15))
    const archivedResults = await Promise.allSettled([archive, rejected])
    assert.equal(archivedResults[0].status, 'fulfilled')
    assert.equal(archivedResults[1].status, 'rejected')
    assert.match(archivedResults[1].reason.message, /EVO_STORE_CHECKOUT_UNAVAILABLE/)
    assert.equal(inventory(8), '20:0')

    for (const [table, original] of Object.entries(before)) assert.equal(count(table), original, `${table} isolated from Store reservations`)
    assert.equal(query(`SELECT count(*) FROM public.evo_store_inventory WHERE variant_id IN ('${variant(1)}','${variant(5)}','${variant(6)}','${variant(7)}','${variant(8)}') AND quantity_on_hand=20 AND quantity_reserved=0`), '5')
  })
}
