import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { readVerifiedBaseline } from './database/helpers/baseline.mjs'

const name = '20261006000000_evo_store_checkout_reservation_foundation.sql'
const migration = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const catalog = await readFile(new URL('../supabase/migrations/20261004000000_evo_store_catalog_foundation.sql', import.meta.url), 'utf8')
const databaseTests = await readFile(new URL('./database/supabase/tests/010_store_checkout_foundation.sql', import.meta.url), 'utf8')
const bootstrap = await readFile(new URL('./database/helpers/bootstrap.mjs', import.meta.url), 'utf8')
const integration = await readFile(new URL('./database/database-integration.test.mjs', import.meta.url), 'utf8')
const executable = migration.replace(/--[^\n]*/g, '').replace(/comment on[\s\S]*?;/gi, '')

test('Phase 2J-A introduces exactly the approved tables and no commerce or inventory mutation', () => {
  assert.deepEqual([...executable.matchAll(/create table public\.(\w+)/gi)].map(match => match[1]), [
    'evo_store_checkouts', 'evo_store_checkout_items',
  ])
  const targets = [...executable.matchAll(/(?:alter table|create (?:unique )?index \w+\s+on|before [^;]*? on) public\.(\w+)/gi)].map(match => match[1])
  assert.ok(targets.every(target => ['evo_store_checkouts', 'evo_store_checkout_items', 'evo_store_variant_prices'].includes(target)))
  assert.doesNotMatch(executable, /\b(?:insert into|delete from|update public\.|security definer)\b/i)
  assert.doesNotMatch(executable, /\b(?:orders|order_items|payments|digital_access|payment_refunds|payment_webhook_events|razorpay|cron|evo_store_inventory|evo_store_inventory_movements|adjust_evo_store_inventory)\b/i)
  assert.deepEqual([...executable.matchAll(/create function (\w+\.\w+)/gi)].map(match => match[1]), [
    'private.evo_store_currency_supported', 'private.guard_evo_store_checkout_terminal_status',
  ])
})

test('one whitelist is shared with variant prices and retains every established currency', () => {
  const original = catalog.match(/currency in \(([^)]+)\)/i)[1]
  assert.equal(migration.match(/p_currency in \(([^)]+)\)/i)[1], original)
  assert.equal((migration.match(/check \(private\.evo_store_currency_supported\(currency::text\)\)/g) ?? []).length, 3)
  assert.match(migration, /revoke all on function private\.evo_store_currency_supported\(text\) from public, anon, authenticated/)
  assert.match(migration, /grant execute on function private\.evo_store_currency_supported\(text\) to authenticated, service_role/)
})

test('nullable amounts and expiry are authored without premature defaults or clock authority', () => {
  for (const column of ['shipping_total', 'tax_total', 'grand_total']) assert.match(migration, new RegExp(`  ${column} numeric\\(14,2\\),`))
  assert.match(migration, /expires_at timestamptz not null,/)
  assert.match(migration, /check \(expires_at > created_at\)/)
  assert.doesNotMatch(executable, /interval|clock_timestamp|transaction_timestamp/)
  assert.match(migration, /unique \(user_id, idempotency_key\)/)
  assert.match(migration, /unique index[^;]*\(user_id\) where status = 'active'/)
  assert.match(migration, /\(expires_at, id\) where status = 'active'/)
})

test('commercial history and currency equality use restrictive declarative FKs', () => {
  assert.match(migration, /user_id uuid not null references public\.profiles\(id\) on delete restrict/)
  assert.match(migration, /address_id uuid references public\.addresses\(id\) on delete set null/)
  for (const target of ['evo_store_products', 'evo_store_variants']) assert.match(migration, new RegExp(`references public\\.${target}\\(id\\) on delete restrict`))
  assert.match(migration, /foreign key \(checkout_id, currency\) references public\.evo_store_checkouts\(id, currency\)\s+on delete restrict on update restrict/)
  assert.doesNotMatch(executable, /cascade|billing_|signed_url|storage_path/i)
})

test('RLS and explicit ACLs restrict customers and staff to read access', () => {
  for (const table of ['evo_store_checkouts', 'evo_store_checkout_items']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  assert.equal((migration.match(/for select to authenticated/g) ?? []).length, 4)
  assert.equal((migration.match(/private\.is_staff\(\)/g) ?? []).length, 2)
  assert.match(migration, /checkout\.user_id = \(select auth\.uid\(\)\)/)
  assert.match(migration, /from public, anon, authenticated;\s+grant select on table/)
  assert.doesNotMatch(executable, /grant (?:insert|update|delete)|for (?:insert|update|delete)|with check/i)
  assert.match(migration, /grant select, insert, update, delete[^;]*to service_role/)
})

test('terminal transitions are guarded without restricting future lifecycle RPCs', () => {
  assert.match(migration, /old\.status <> 'active'::public\.evo_store_checkout_status\s+and new\.status is distinct from old\.status/)
  assert.match(migration, /language plpgsql security invoker\s+set search_path = ''/)
  assert.match(migration, /before update of status on public\.evo_store_checkouts/)
  assert.match(migration, /revoke all on function private\.guard_evo_store_checkout_terminal_status\(\) from public, anon, authenticated/)
})

test('disposable integration applies the real migration and runs comprehensive pgTAP without changing the baseline', async () => {
  await readVerifiedBaseline()
  assert.ok(bootstrap.includes(name))
  assert.ok(integration.includes('010_store_checkout_foundation.sql'))
  for (const assertion of ['columns_are', 'col_type_is', 'col_not_null', 'col_is_null', 'col_is_pk', 'has_table_privilege', 'pg_get_constraintdef', 'pg_get_indexdef', 'SET LOCAL ROLE anon', 'SET LOCAL ROLE authenticated', 'staff sees all', 'cannot return to active', 'mismatched header currency', 'unchanged by checkout fixture operations']) assert.ok(databaseTests.includes(assertion), assertion)
  assert.ok((databaseTests.match(/SELECT (?:ok|is|throws_ok|lives_ok|col_|columns_are|has_table)/g) ?? []).length > 200)
  assert.match(databaseTests, /SELECT \* FROM finish\(\);\s+ROLLBACK;/)
})
