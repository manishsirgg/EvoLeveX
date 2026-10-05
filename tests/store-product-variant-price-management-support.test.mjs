import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20261005030000_evo_store_variant_price_management_support.sql',
  import.meta.url,
)
await access(migrationUrl)
const migration = await readFile(migrationUrl, 'utf8')

test('exact variant-price prerequisite and private trigger exist', () => {
  assert.match(migration, /function private\.guard_evo_store_archived_product_variant_prices\(\)/i)
  assert.match(migration, /create trigger evo_store_variant_prices_guard_archived/i)
  assert.match(migration, /before insert or update or delete on public\.evo_store_variant_prices/i)
  assert.doesNotMatch(migration, /create\s+table|alter\s+table|drop\s+table/i)
})

test('guard resolves old and new variant ownership and locks products deterministically', () => {
  assert.match(migration, /from public\.evo_store_variants variant[\s\S]*old\.variant_id[\s\S]*new\.variant_id/i)
  assert.match(migration, /from public\.evo_store_products product[\s\S]*order by product\.id\s+for update/i)
  assert.match(migration, /tg_op <> 'INSERT'[\s\S]*old\.variant_id/i)
  assert.match(migration, /tg_op <> 'DELETE'[\s\S]*new\.variant_id/i)
})

test('guard is hardened and emits the stable archived-product error', () => {
  assert.match(migration, /security definer\s+set search_path = ''/i)
  assert.match(migration, /publication_status\s*=\s*'archived'::public\.evo_store_publication_status/i)
  assert.match(migration, /errcode\s*=\s*'P0001'[\s\S]*message\s*=\s*'EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT'/i)
  assert.match(migration, /revoke all on function private\.guard_evo_store_archived_product_variant_prices\(\)\s+from public, anon, authenticated/i)
})

test('migration does not expand authority or redesign Store pricing', () => {
  assert.doesNotMatch(migration, /function public\.|grant\s+execute|service_role|create\s+policy|drop\s+policy|row level security/i)
  assert.doesNotMatch(migration, /evo_store_variants\.(?:price|currency)|normalize.*currency|price_history/i)
  assert.doesNotMatch(migration, /inventory|checkout|razorpay|refund|shipping|\bfx\b|\btax\b|gst/i)
  assert.doesNotMatch(migration, /numeric\s*\(|amount\s+(?:check|constraint)|supported.currenc|jpy|unique\s*\(/i)
})
