import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

import {
  normalizeStoreCartItems, parseStoreCartPayload, serializeStoreCart,
  STORE_CART_MAX_BYTES, STORE_CART_STORAGE_KEY,
} from '../src/lib/store-cart.ts'
import { storeAmountToMinor, storeMinorToAmount } from '../src/lib/store-money.ts'

const provider = await readFile(new URL('../src/components/store/store-cart-provider.tsx', import.meta.url), 'utf8')
const indicator = await readFile(new URL('../src/components/store/store-cart-indicator.tsx', import.meta.url), 'utf8')
const selector = await readFile(new URL('../src/components/store/storefront-variant-selector.tsx', import.meta.url), 'utf8')
const resolver = await readFile(new URL('../src/lib/store-cart-resolver.ts', import.meta.url), 'utf8')
const route = await readFile(new URL('../src/app/api/store/cart/resolve/route.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/components/store/store-cart-page.tsx', import.meta.url), 'utf8')

const A = '123e4567-e89b-42d3-a456-426614174000'
test('storage contract is versioned, bounded, strict, normalized, and identity-only', () => {
  assert.equal(STORE_CART_STORAGE_KEY, 'evo_store_cart_v1')
  assert.equal(STORE_CART_MAX_BYTES, 16 * 1024)
  assert.equal(parseStoreCartPayload('{'), null)
  assert.equal(parseStoreCartPayload(JSON.stringify({ version: 2, items: [] })), null)
  assert.equal(parseStoreCartPayload(JSON.stringify({ version: 1, items: [{ variant_id: 'bad', quantity: 1 }] })), null)
  assert.deepEqual(normalizeStoreCartItems([{ variant_id: A, quantity: 7 }, { variant_id: A, quantity: 7 }]), [{ variant_id: A, quantity: 10 }])
  const serialized = serializeStoreCart([{ variant_id: A, quantity: 1 }])
  assert.deepEqual(JSON.parse(serialized), { version: 1, items: [{ variant_id: A, quantity: 1 }] })
  assert.equal(parseStoreCartPayload('x'.repeat(STORE_CART_MAX_BYTES + 1)), null)
  assert.equal(normalizeStoreCartItems(Array.from({ length: 51 }, (_, index) => ({ variant_id: `123e4567-e89b-42d3-a456-${index.toString(16).padStart(12, '0')}`, quantity: 1 }))), null)
})

test('money is decimal-validated and uses BigInt minor units', () => {
  assert.equal(storeAmountToMinor('999999999999.99', 'USD'), 99999999999999n)
  assert.equal(storeAmountToMinor('1.01', 'USD') * 10n, 1010n)
  assert.equal(storeAmountToMinor('1.1', 'JPY'), null)
  assert.equal(storeMinorToAmount(5050n, 'USD'), '50.50')
  assert.equal(Array.from({ length: 50 }, () => 99999999999999n * 10n).reduce((a, b) => a + b), 49999999999999500n)
})

test('provider hydrates locally, persists identity, synchronizes tabs, and badge uses quantity sum', () => {
  assert.match(provider, /items: StoreCartItem\[\]/)
  assert.match(provider, /isHydrated.*false/)
  assert.match(provider, /localStorage\.getItem\(STORE_CART_STORAGE_KEY\)/)
  assert.match(provider, /addEventListener\('storage'/)
  assert.match(provider, /event\.key !== STORE_CART_STORAGE_KEY/)
  assert.match(provider, /reduce\(\(sum, item\) => sum \+ item\.quantity/)
  assert.match(indicator, /isHydrated && itemCount > 0/)
  assert.match(indicator, /Store cart, \$\{itemCount\}/)
})

test('add-to-cart uses the selected variant, quantity and eligibility without authority snapshots', () => {
  assert.match(selector, /addItem\(selected\.id, quantity\)/)
  assert.match(selector, /useState\(1\)/)
  assert.match(selector, /max="10"/)
  assert.match(selector, /disabled=\{!selected\.price \|\| selected\.availability !== 'in_stock'\}/)
  assert.doesNotMatch(selector, /reserve|inventory|price:/i)
})

test('resolver uses ordinary client, explicit public filters and fixed batched boundaries', () => {
  assert.match(resolver, /createClient.*supabase\/server/)
  assert.match(resolver, /publication_status', 'published'/)
  assert.match(resolver, /product_mode', 'physical'/)
  assert.match(resolver, /get_evo_store_variant_availability/)
  assert.equal((resolver.match(/createSignedUrls\(/g) ?? []).length, 1)
  assert.doesNotMatch(resolver, /service-role|requireUser|requireAdmin|evo_store_inventory|quantity_reserved/)
  assert.doesNotMatch(resolver, /\.insert\(|\.update\(|\.delete\(/)
})

test('route is anonymous strict same-origin POST with safe no-store errors', () => {
  assert.match(route, /export async function POST/)
  assert.match(route, /isSameOrigin/)
  assert.match(route, /Cache-Control', 'no-store'/)
  assert.match(route, /Object\.keys\(body\)\.length !== 1/)
  assert.match(route, /STORE_CART_MAX_BYTES/)
  assert.doesNotMatch(route, /auth\.getUser|requireUser|requireAdmin|price|currency.*body/i)
})

test('cart UI covers stale/status/totals/edit/retry and contains no checkout', () => {
  for (const text of ['Your Store cart is empty.', 'Continue shopping', 'No longer available.', 'Sold out.', 'Currently unavailable.', 'Not available in your selected currency.', 'Clear cart', 'Retry', 'Subtotal']) assert.match(page, new RegExp(text.replace(/[.]/g, '\\$&')))
  assert.match(page, /AbortController/)
  assert.match(page, /aria-label=\{`Decrease quantity/)
  assert.match(page, /role="alert"/)
  assert.doesNotMatch(page, /checkout|Razorpay|reservation/i)
})

test('phase is application-only and introduces no migration', async () => {
  const migrations = await readdir(new URL('../supabase/migrations/', import.meta.url))
  assert.equal(migrations.some((name) => name.includes('cart')), false)
  const combined = provider + selector + resolver + route + page
  assert.doesNotMatch(combined, /VaultBuyNow|api\/vault\/orders|service_role|quantity_reserved/)
})
