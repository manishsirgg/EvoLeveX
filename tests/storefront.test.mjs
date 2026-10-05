import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const data = await readFile(new URL('../src/lib/storefront.ts', import.meta.url), 'utf8')
const catalog = await readFile(new URL('../src/app/(site)/store/page.tsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('../src/app/(site)/store/[slug]/page.tsx', import.meta.url), 'utf8')
const card = await readFile(new URL('../src/components/store/storefront-product-card.tsx', import.meta.url), 'utf8')
const gallery = await readFile(new URL('../src/components/store/storefront-gallery.tsx', import.meta.url), 'utf8')
const selector = await readFile(new URL('../src/components/store/storefront-variant-selector.tsx', import.meta.url), 'utf8')
const nextConfig = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8')

test('catalog and detail routes are request-time public server pages with canonical metadata', () => {
  assert.match(catalog, /export default async function StorePage/)
  assert.match(detail, /export default async function StoreProductPage/)
  assert.match(catalog, /searchParams: Promise/)
  assert.match(catalog, /https:\/\/evolevex\.com\/store/)
  assert.match(detail, /generateMetadata/)
  assert.match(detail, /storeProductUrl\(product\.slug\)/)
  assert.match(detail, /if \(!product\) notFound\(\)/)
  assert.doesNotMatch(catalog + detail + data, /requireAdmin|auth\.getUser|redirect\(['"]\/auth/)
})

test('publication is filtered server-side and invisible slugs use the same not-found path', () => {
  for (const pattern of [/\.eq\('publication_status', 'published'\)/, /\.eq\('is_active', true\)/, /\.eq\('product_mode', 'physical'\)/]) {
    assert.ok((data.match(new RegExp(pattern.source, 'g')) ?? []).length >= 2)
  }
  assert.equal((detail.match(/notFound\(\)/g) ?? []).length, 2)
  assert.doesNotMatch(data, /admin-store|service-role|service_role|SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(data, /createClient.*supabase\/server/)
})

test('catalog categories, deterministic ordering, limit, and featured partition match V1', () => {
  assert.match(data, /evo_store_categories'[\s\S]*\.eq\('is_active', true\)/)
  assert.match(data, /categorySlug \? allProducts\.filter/)
  assert.match(data, /\.order\('sort_order',[\s\S]*\.order\('created_at', \{ ascending: false \}\)[\s\S]*\.order\('id'/)
  assert.match(data, /\.limit\(CATALOG_LIMIT\)/)
  assert.match(data, /const CATALOG_LIMIT = 100/)
  assert.match(catalog, /product\.isFeatured/)
  assert.match(catalog, /!product\.isFeatured/)
  assert.match(catalog, /No products are currently available in this category\./)
  assert.doesNotMatch(catalog, /pagination|type="search"/i)
})

test('private image metadata is filtered then signed once per loader with a one-hour TTL', () => {
  assert.match(data, /const STORE_BUCKET = 'evo-store-products'/)
  assert.match(data, /const SIGNED_IMAGE_TTL_SECONDS = 3600/)
  assert.equal((data.match(/\.createSignedUrls\(/g) ?? []).length, 1)
  assert.match(data, /evo_store_product_images'[\s\S]*\.eq\('is_active', true\)/)
  assert.match(data, /\.eq\('is_primary', true\)/)
  assert.match(data, /\.order\('is_primary', \{ ascending: false \}\)[\s\S]*\.order\('sort_order'/)
  assert.match(data, /if \(!signed\?\.signedUrl \|\| signed\.error\) return/)
  assert.doesNotMatch(data.slice(0, data.indexOf('type ProductRow')), /storage_path/)
  assert.match(card + gallery, /<img/)
  assert.doesNotMatch(nextConfig, /remotePatterns/)
  assert.match(catalog + detail, /\/favicon\.ico/)
  assert.doesNotMatch(catalog + detail, /signedUrl/)
})

test('variants use active rows, authoritative selected-currency positive prices, and batch RPCs', () => {
  assert.match(data, /evo_store_variants'[\s\S]*\.eq\('is_active', true\)/)
  assert.match(data, /evo_store_variant_prices/)
  assert.match(data, /\.eq\('currency', currency\)\.eq\('is_active', true\)\.gt\('amount', 0\)/)
  assert.equal((data.match(/get_evo_store_variant_availability/g) ?? []).length, 2)
  assert.doesNotMatch(data, /evo_store_inventory(?:_movements)?/)
  assert.doesNotMatch(data, /base_price|quantity_on_hand|quantity_reserved|available_quantity|weight_g|attributes|digital_file_path/)
  assert.doesNotMatch(data, /evo_store_variants'\)\.select\([^\n]*(?:price|currency)/)
})

test('price and status semantics are derived only from authorized DTO values', () => {
  assert.match(data, /new Set\(amounts\)\.size === 1 \? formatMoney\(minimum, currency\) : `From/)
  assert.match(data, /if \(!amounts\.length\) return `Not available in \$\{currency\}`/)
  assert.match(data, /priced\.some\(\(variant\) => variant\.availability === 'in_stock'\)/)
  assert.match(data, /priced\.some\(\(variant\) => variant\.availability === 'out_of_stock'\)/)
  assert.match(selector, /Not available in your selected currency\./)
  assert.match(selector, /Choose another currency from the currency selector/)
  assert.doesNotMatch(data + selector, /resolveStorefrontPrice|exchange|fallback.*USD|client FX/i)
})

test('initial and linked variant selection handle nullable dimensions deterministically', () => {
  assert.match(data, /amount !== null && variant\.availability === 'in_stock'/)
  assert.match(data, /variants\.find\(\(variant\) => variant\.amount !== null\)/)
  assert.match(selector, /filter\(\(value\): value is string => Boolean\(value\)\)/)
  assert.match(selector, /retained \?\? variants\.find/)
  assert.match(selector, /disabled=\{!exists\}/)
  assert.match(selector, /aria-pressed/)
  assert.match(selector, /SKU \{selected\.sku\}/)
  assert.match(selector, /out_of_stock: 'Sold out'/)
})

test('public DTOs and pages avoid internal data, unsafe HTML, and future commerce scope', () => {
  assert.doesNotMatch(data, /metadata_json|readiness|created_at:|updated_at:/)
  assert.doesNotMatch(catalog + detail + card + gallery + selector, /dangerouslySetInnerHTML/)
  assert.match(detail, /\{product\.description\}/)
  assert.match(selector, /Add to Cart/)
  assert.doesNotMatch(catalog + detail + card + gallery + selector, /Cart coming soon|Razorpay|reservation/i)
  assert.doesNotMatch(data, /\.insert\(|\.update\(|\.delete\(/)
})
