import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20261005040000_evo_store_inventory_management_support.sql',
  import.meta.url,
)
await access(migrationUrl)
const migration = await readFile(migrationUrl, 'utf8')
const inventoryDatabaseTest = await readFile(
  new URL('./database/supabase/tests/009_store_inventory.sql', import.meta.url),
  'utf8',
)
const concurrencyFixture = await readFile(
  new URL('./database/supabase/tests/fixtures_concurrency.sql', import.meta.url),
  'utf8',
)
const integrationTest = await readFile(
  new URL('./database/database-integration.test.mjs', import.meta.url),
  'utf8',
)
const rpcStart = migration.search(/create or replace function public\.adjust_evo_store_inventory/i)
const rpc = migration.slice(rpcStart)

test('inventory archive guard covers every mutation and both variant owners', () => {
  assert.match(migration, /function private\.guard_evo_store_archived_product_inventory\(\)/i)
  assert.match(migration, /create trigger evo_store_inventory_guard_archived/i)
  assert.match(migration, /before insert or update or delete on public\.evo_store_inventory/i)
  assert.match(migration, /tg_op <> 'INSERT'[\s\S]*old\.variant_id/i)
  assert.match(migration, /tg_op <> 'DELETE'[\s\S]*new\.variant_id/i)
})

test('inventory guard is hardened, deterministic, and emits the stable error', () => {
  assert.match(migration, /security definer\s+set search_path = ''/i)
  assert.match(migration, /order by product\.id\s+for update/i)
  assert.match(migration, /errcode\s*=\s*'P0001'[\s\S]*message\s*=\s*'EVO_STORE_INVENTORY_ARCHIVED_PRODUCT'/i)
  assert.match(migration, /revoke all on function private\.guard_evo_store_archived_product_inventory\(\)\s+from public, anon, authenticated/i)
})

test('the existing inventory RPC is replaced in place with its exact contract', () => {
  assert.match(rpc, /adjust_evo_store_inventory\(\s*p_variant_id uuid, p_mode text, p_quantity integer, p_reason text\s*\)/i)
  assert.match(rpc, /returns table \(\s*variant_id uuid, quantity_on_hand integer, quantity_reserved integer,\s*available_quantity integer, low_stock_threshold integer\s*\)/i)
  assert.match(rpc, /p_mode not in \('initialize', 'adjust', 'set'\)/i)
  assert.match(rpc, /'initial_stock', 'stock_received', 'stock_count', 'damage', 'loss', 'manual_correction'/i)
  assert.match(rpc, /private\.is_staff\(\)/i)
  assert.match(rpc, /security definer\s+set search_path = ''/i)
})

test('RPC locks the owning product before any inventory mutation', () => {
  const ownerLookup = rpc.search(/select variant\.product_id into owning_product_id/i)
  const productLock = rpc.search(/from public\.evo_store_products product[\s\S]*?for update;/i)
  const inventoryMutation = rpc.search(/insert into public\.evo_store_inventory/i)
  assert.ok(ownerLookup >= 0 && ownerLookup < productLock)
  assert.ok(productLock < inventoryMutation)
  assert.match(rpc, /owning_product_status\s*=\s*'archived'[\s\S]*EVO_STORE_INVENTORY_ARCHIVED_PRODUCT/i)
  assert.match(rpc, /errcode = '23503', message = 'inventory variant does not exist'/i)
})

test('inventory authority remains narrow', () => {
  assert.match(migration, /revoke all on function public\.adjust_evo_store_inventory\(uuid, text, integer, text\)\s+from public, anon/i)
  assert.match(migration, /grant execute on function public\.adjust_evo_store_inventory\(uuid, text, integer, text\)\s+to authenticated/i)
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger\s+on table public\.evo_store_inventory from authenticated/i)
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger\s+on table public\.evo_store_inventory_movements from authenticated/i)
  assert.doesNotMatch(migration, /\bservice_role\b|create\s+policy|grant\s+(?:insert|update|delete)/i)
})

test('prerequisite does not alter readiness, availability, or add reservations/application scope', () => {
  assert.doesNotMatch(migration, /get_evo_store_variant_availability|evo_store_product_readiness_error|inspect_evo_store_product_readiness/i)
  assert.doesNotMatch(migration, /create\s+table|alter\s+table|quantity_reserved\s*=|reservation|checkout|razorpay|shipping|refund/i)
  assert.doesNotMatch(migration, /quantity_on_hand\s*>\s*0|available_quantity\s*>\s*0/i)
})

test('database fixtures isolate variant dimensions and provision the concurrency user as staff', () => {
  for (const suffix of ['004', '005', '006']) {
    assert.match(
      inventoryDatabaseTest,
      new RegExp(`57000000-0000-4000-8000-000000000${suffix}'.*47000000-0000-4000-8000-000000000${suffix}`, 'i'),
    )
  }
  assert.match(concurrencyFixture, /insert into public\.roles[\s\S]*'admin'[\s\S]*insert into public\.user_roles/i)
  assert.match(concurrencyFixture, /select '12000000-0000-4000-8000-000000000001',id from public\.roles where code='admin'/i)
})

test('published zero-stock fixture uses the authoritative product-scoped image path', () => {
  assert.match(
    inventoryDatabaseTest,
    /'67000000-0000-4000-8000-000000000003','47000000-0000-4000-8000-000000000003','47000000-0000-4000-8000-000000000003\/67000000-0000-4000-8000-000000000003\.jpg',true,true/i,
  )
  assert.doesNotMatch(inventoryDatabaseTest, /'products\/zero\/image\.jpg'|'zero\/image\.jpg'/i)
})

test('every inventory RPC subprocess establishes its own authenticated staff context', () => {
  assert.match(integrationTest, /const auth = `SET ROLE authenticated; SELECT set_config\('request\.jwt\.claim\.sub'/i)
  const inventorySection = integrationTest.slice(
    integrationTest.indexOf("serialTest('Store inventory mutation"),
    integrationTest.indexOf("serialTest('concurrent commerce operations"),
  )
  const authenticatedRpcTemplates = inventorySection.match(
    /\$\{auth\}[\s\S]{0,240}?adjust_evo_store_inventory/g,
  ) ?? []
  assert.ok(authenticatedRpcTemplates.length >= 6)
})
