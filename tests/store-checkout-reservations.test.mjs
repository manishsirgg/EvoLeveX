import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { readVerifiedBaseline } from './database/helpers/baseline.mjs'

const migrationName = '20261006010000_evo_store_transactional_inventory_reservations.sql'
const migration = await readFile(new URL(`../supabase/migrations/${migrationName}`, import.meta.url), 'utf8')
const executable = migration.replace(/--[^\n]*/g, '')
const bootstrap = await readFile(new URL('./database/helpers/bootstrap.mjs', import.meta.url), 'utf8')
const integration = await readFile(new URL('./database/database-integration.test.mjs', import.meta.url), 'utf8')
const behavior = await readFile(new URL('./database/supabase/tests/011_store_checkout_reservations.sql', import.meta.url), 'utf8')
const concurrency = await readFile(new URL('./database/store-checkout-concurrency.mjs', import.meta.url), 'utf8')

test('reservation migration has exactly the approved customer mutation surface', () => {
  assert.deepEqual([...executable.matchAll(/create function public\.(\w+)\(/g)].map(match => match[1]), ['create_evo_store_checkout', 'release_evo_store_checkout'])
  assert.doesNotMatch(executable, /create (?:table|type|policy|trigger)|alter table|disable trigger|set_config|session_replication_role/i)
  assert.doesNotMatch(executable, /\b(?:orders|order_items|payments|digital_access|razorpay|cron|skip locked|consume_evo_store_checkout|expire_evo_store_checkouts)\b/i)
  assert.doesNotMatch(executable, /(?:insert into|update|delete from) public\.evo_store_inventory_movements/i)
  assert.doesNotMatch(executable, /set\s+quantity_on_hand\s*=/i)
})

test('RPC security boundaries are explicit and helpers remain private', () => {
  for (const signature of ['create_evo_store_checkout(jsonb, text, uuid, uuid)', 'release_evo_store_checkout(uuid)']) {
    assert.ok(executable.includes(`revoke all on function public.${signature} from public, anon, service_role`))
    assert.ok(executable.includes(`grant execute on function public.${signature} to authenticated`))
  }
  const rpcBodies = executable.split(/create function public\./).slice(1)
  for (const body of rpcBodies) {
    assert.match(body, /returns jsonb language plpgsql security definer set search_path = ''/)
    assert.match(body, /customer uuid := auth\.uid\(\)/)
    assert.doesNotMatch(body, /p_user_id|grant (?:insert|update|delete)/i)
    assert.match(body, /integrity_constraint_violation or data_exception or deadlock_detected or serialization_failure/)
  }
  for (const name of ['lock_evo_store_checkout_inventory', 'finish_evo_store_checkout_hold', 'evo_store_checkout_result']) {
    assert.match(executable, new RegExp(`revoke all on function private\\.${name}[^;]+from public, anon, authenticated, service_role`))
  }
})

test('serialization precedes lifecycle, ordered locks and inventory effects', () => {
  const create = executable.split('create function public.create_evo_store_checkout(')[1].split('create function public.release_evo_store_checkout(')[0]
  const positions = ['pg_advisory_xact_lock', 'select * into existing', 'select * into active_checkout', 'lock_evo_store_checkout_inventory(locked_variants', 'finish_evo_store_checkout_hold(active_checkout.id', 'insert into public.evo_store_checkouts', 'set quantity_reserved = inventory.quantity_reserved + item.quantity'].map(marker => create.indexOf(marker))
  assert.ok(positions.every(position => position >= 0))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
  assert.match(executable, /order by p\.id for update/)
  assert.match(executable, /order by i\.variant_id for update/)
  assert.match(create, /union select i\.variant_id/)
  assert.match(executable, /current_owners <> owners/)
  assert.equal((executable.match(/hashtextextended\('evo_store_checkout:user:'/g) ?? []).length, 2)
})

test('replay preserves snapshots and the fingerprint canonicalizes input order', () => {
  assert.match(executable, /jsonb_agg\(value order by \(value ->> 'variant_id'\)::uuid\)/)
  assert.match(executable, /fingerprint := pg_catalog\.jsonb_build_object\('currency', currency_code,\s+'address_id', p_address_id, 'items', canonical\)::text/)
  assert.match(executable, /return private\.evo_store_checkout_result\(existing.id\)/)
  assert.match(executable, /transaction_timestamp\(\) \+ interval '30 minutes'/)
  assert.doesNotMatch(executable, /set\s+expires_at\s*=/i)
})

test('return DTO excludes inventory/fingerprint while snapshotting authoritative variant codes', () => {
  const dto = executable.split('create function private.evo_store_checkout_result')[1].split('create function public.create_evo_store_checkout')[0]
  assert.doesNotMatch(dto, /request_fingerprint|quantity_on_hand|quantity_reserved|user_id|to_jsonb\(c\)/)
  assert.match(executable, /'size_code', line\.size_code, 'color_code', line\.color_code/)
  assert.match(executable, /private\.evo_store_product_readiness_error\(line.product_id\)/)
  assert.match(executable, /a\.id = p_address_id and a\.user_id = customer/)
  assert.match(executable, /private\.evo_store_currency_supported\(currency_code\)/)
})

test('archived inventory exception permits only decrementing reservations and accounting never clamps', () => {
  const guard = executable.split('create function private.lock_evo_store_checkout_inventory')[0]
  assert.match(guard, /new\.quantity_reserved < old\.quantity_reserved/)
  assert.match(guard, /to_jsonb\(new\) - 'quantity_reserved' - 'updated_at'/)
  assert.match(guard, /EVO_STORE_INVENTORY_ARCHIVED_PRODUCT/)
  assert.doesNotMatch(executable, /greatest\(|least\(/i)
  assert.match(executable, /inventory\.quantity_reserved < item\.quantity/)
  assert.match(executable, /EVO_STORE_CHECKOUT_RECONCILIATION_REQUIRED/)
})

test('actual migration and behavior/race suites are wired into the fail-closed disposable harness', async () => {
  await readVerifiedBaseline()
  assert.ok(bootstrap.includes(migrationName))
  assert.ok(integration.includes('011_store_checkout_reservations.sql'))
  assert.ok(integration.includes('registerStoreCheckoutConcurrency(serialTest)'))
  assert.ok((behavior.match(/SELECT (?:ok|is|throws_ok|lives_ok)\(/g) ?? []).length >= 150)
  for (const required of ['AUTH_REQUIRED', 'INVALID_ITEM', 'INVALID_QUANTITY', 'DUPLICATE_VARIANT', 'PRICE_MISSING', 'PRICE_INVALID', 'ACTIVE_EXISTS', 'OUT_OF_STOCK', 'IDEMPOTENCY_CONFLICT', 'RECONCILIATION_REQUIRED', 'ALREADY_CONSUMED']) assert.ok(behavior.includes(`EVO_STORE_CHECKOUT_${required}`), required)
  for (const required of ['A:', 'B:', 'C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'Promise.allSettled', 'statement_timeout', 'archival transaction owns its lock']) assert.ok(concurrency.includes(required), required)
  assert.match(behavior, /SELECT \* FROM finish\(\);\s+ROLLBACK;/)
})
