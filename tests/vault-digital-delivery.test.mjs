import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const route = read('src/app/api/vault/books/download/route.ts')
const access = read('src/lib/vault-access.ts')
const library = read('src/app/account/library/page.tsx')
const download = read('src/components/vault/vault-book-download.tsx')
const nav = read('src/app/account/account-nav.tsx')
const buyNow = read('src/components/vault/vault-buy-now.tsx')

test('library remains authenticated and server-driven', () => {
  assert.match(library, /auth\.getUser\(\)/)
  assert.match(library, /redirect\('\/auth\/login'\)/)
  assert.match(library, /getVaultLibrary\(supabase, user\.id\)/)
  assert.match(nav, /Overview'[\s\S]*\/account\/library', label: 'My Library'/)
  assert.doesNotMatch(library, /digital_file_path|signedUrl|evo-private/)
})

test('library lists every active asset in deterministic order without selecting private paths', () => {
  assert.match(access, /from\('evo_vault_book_assets'\)[\s\S]*\.eq\('is_active', true\)/)
  assert.match(access, /select\('id,vault_product_id,title,file_size,is_primary,sort_order,created_at'\)/)
  assert.match(access, /order\('sort_order'[\s\S]*order\('created_at'[\s\S]*order\('id'/)
  assert.doesNotMatch(access.match(/from\('evo_vault_book_assets'\)[\s\S]*?assetsResult/s)?.[0] ?? '', /file_path/)
})

test('multiple assets are grouped as included files with primary and supplementary downloads', () => {
  assert.match(library, /book\.assets\.length > 1/)
  assert.match(library, /Included files/)
  assert.match(library, /asset\.title/)
  assert.match(library, /asset\.isPrimary[\s\S]*Primary book/)
  assert.match(library, /book\.assets\.map/)
})

test('one normalized asset keeps the simple single-button experience', () => {
  assert.match(library, /book\.assets\.length === 1/)
  assert.match(library, /assetId=\{book\.assets\[0\]\.assetId\}/)
  assert.doesNotMatch(download, /filePath|file_path|evo-private/)
})

test('browser sends an asset UUID, never a private path or authorization claim', () => {
  assert.match(download, /JSON\.stringify\(assetId \? \{ assetId \}/)
  assert.doesNotMatch(download, /userId|user_id|filePath|file_path|bucket|entitlement|accessId/)
  assert.match(route, /Object\.keys\(body\)\.length !== 1/)
  assert.match(route, /UUID\.test\(body\.assetId\)/)
})

test('download rejects unauthenticated callers before any delivery or signing', () => {
  const authFailure = route.indexOf('if (authError || !user)')
  assert.ok(authFailure > route.indexOf('auth.getUser()'))
  assert.ok(authFailure < route.indexOf('getDeliverableVaultAsset('))
  assert.match(route, /Authentication required' \}, 401/)
})

test('unknown and inactive assets fail the same safe unavailable response', () => {
  assert.match(access, /\.eq\('id', assetId\)\.eq\('is_active', true\)\.maybeSingle\(\)/)
  assert.match(access, /if \(!asset[\s\S]*\) return null/)
  assert.match(route, /if \(!delivery\) return json\(\{ error: 'Book download unavailable' \}, 404\)/)
})

test('asset-derived product ID is the sole normalized entitlement scope', () => {
  assert.match(access, /\.eq\('vault_product_id', asset\.vault_product_id\)/)
  assert.match(access, /\.eq\('source', 'evo_vault'\)/)
  assert.match(access, /\.eq\('status', 'active'\)/)
  assert.match(access, /\.is\('revoked_at', null\)/)
  assert.match(access, /expires_at\.is\.null,expires_at\.gt\./)
  assert.doesNotMatch(route, /getDeliverableVaultAsset\([^)]*body\.productId/)
})

test('primary and supplementary assets share the same active-owner delivery path', () => {
  assert.match(access, /getDeliverableVaultAsset/)
  assert.doesNotMatch(access, /asset\.is_primary.*return null|\.eq\('is_primary', true\)/)
  assert.match(access, /eligibleProductAndBook\(userId, asset\.vault_product_id, assetId\)/)
  assert.match(access, /kind', 'book'[\s\S]*product_mode/)
})

test('signing occurs only after authentication, asset, entitlement, and eligibility resolution', () => {
  const delivery = route.indexOf('getDeliverableVaultAsset(')
  const signing = route.indexOf('.createSignedUrl(')
  assert.ok(route.indexOf('auth.getUser()') < delivery && delivery < signing)
  assert.match(route, /SIGNED_URL_TTL_SECONDS = 60/)
  assert.match(route, /storage\.from\(VAULT_BOOK_PDF_BUCKET\)/)
  assert.match(route, /download: downloadFilename\(delivery\.assetTitle/)
})

test('successful issuance logs the exact asset and access used before returning the URL', () => {
  const signing = route.indexOf('.createSignedUrl(')
  const audit = route.indexOf("from('digital_download_logs').insert(")
  const response = route.indexOf('return json({ url: signed.data.signedUrl })')
  assert.ok(signing > -1 && audit > signing && response > audit)
  assert.match(route, /user_id: user\.id/)
  assert.match(route, /digital_access_id: delivery\.accessId/)
  assert.match(route, /asset_id: delivery\.assetId/)
  assert.match(route, /file_path: delivery\.filePath/)
  assert.match(route, /metadata: \{ event: 'signed_url_issued' \}/)
})

test('legacy fallback requires zero active normalized assets and cannot duplicate a button', () => {
  assert.match(access, /getDeliverableLegacyVaultBook/)
  assert.match(access, /activeAssets\.data\?\.length[\s\S]*> 0\) return null/)
  assert.match(access, /if \(assets\.length === 0[\s\S]*digital_file_path/)
  assert.match(access, /Never mix the compatibility representation with normalized assets/)
  assert.match(download, /assetId \? \{ assetId \} : \{ productId: legacyProductId \}/)
})

test('private implementation data is not serialized into library markup or client props', () => {
  assert.doesNotMatch(library, /filePath|file_path|digital_file_path|evo-private/)
  assert.doesNotMatch(download, /filePath|file_path|storagePath|bucket|service-role/)
  assert.match(route, /Cache-Control', 'private, no-store'/)
  assert.match(route, /return json\(\{ url: signed\.data\.signedUrl \}\)/)
})

test('safe diagnostics and Stage 2B/admin/checkout behavior remain intact', () => {
  assert.match(access, /safeVaultDiagnosticField/)
  assert.match(read('src/lib/supabase/service-role.ts'), /import 'server-only'/)
  assert.equal((buyNow.match(/href="\/account\/library"/g) ?? []).length, 2)
  assert.match(buyNow, /fetch\('\/api\/payments\/razorpay\/verify'/)
})
