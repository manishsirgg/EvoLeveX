import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const route = read('src/app/api/vault/books/download/route.ts')
const access = read('src/lib/vault-access.ts')
const library = read('src/app/account/library/page.tsx')
const nav = read('src/app/account/account-nav.tsx')
const buyNow = read('src/components/vault/vault-buy-now.tsx')

test('provides an authenticated My Library route and account navigation', () => {
  assert.match(library, /auth\.getUser\(\)/)
  assert.match(library, /redirect\('\/auth\/login'\)/)
  assert.match(library, /getVaultLibrary\(supabase, user\.id\)/)
  assert.match(nav, /Overview'[\s\S]*\/account\/library', label: 'My Library'/)
  assert.doesNotMatch(library, /digital_file_path|signedUrl|evo-private/)
})

test('download request is same-origin, exact-shape, UUID validated, and authenticated', () => {
  assert.match(route, /isSameOrigin\(request\)/)
  assert.match(route, /Object\.keys\(body\)\.length !== 1/)
  assert.match(route, /!\('productId' in body\)/)
  assert.match(route, /UUID\.test\(body\.productId\)/)
  assert.match(route, /auth\.getUser\(\)/)
  assert.match(route, /getDeliverableVaultBook\(supabase, user\.id, body\.productId\)/)
  assert.doesNotMatch(route, /body\.(user|userId|user_id|filePath|file_path|bucket|accessId|digital_access_id)/)
})

test('central helper enforces the complete active Vault entitlement predicate', () => {
  assert.match(access, /\.eq\('user_id', userId\)/)
  assert.match(access, /\.eq\('source', 'evo_vault'\)/)
  assert.match(access, /\.eq\('status', 'active'\)/)
  assert.match(access, /\.is\('revoked_at', null\)/)
  assert.match(access, /expires_at\.is\.null,expires_at\.gt\./)
  assert.match(access, /\.eq\('vault_product_id', productId\)/)
})

test('delivery resolves a valid digital Vault book and managed private path authoritatively', () => {
  assert.match(access, /from\('evo_vault_products'\)[\s\S]*\.eq\('kind', 'book'\)\.in\('product_mode'/)
  assert.match(access, /from\('evo_vault_books'\)\.select\('vault_product_id,digital_file_path,digital_file_size'\)/)
  assert.match(access, /digital_file_size !== 'number'[\s\S]*digital_file_size <= 0/)
  assert.match(access, /ownedVaultBookPdfPath\(VAULT_BOOK_PDF_BUCKET, book\.digital_file_path, product\.id\)/)
  assert.doesNotMatch(access, /\.eq\('is_active'/)
})

test('service-only signing uses a controlled bucket, filename, and 60 second TTL', () => {
  assert.match(route, /createServiceRoleClient/)
  assert.match(route, /SIGNED_URL_TTL_SECONDS = 60/)
  assert.match(route, /storage\.from\(VAULT_BOOK_PDF_BUCKET\)/)
  assert.match(route, /createSignedUrl\(delivery\.filePath, SIGNED_URL_TTL_SECONDS/)
  assert.match(route, /download: downloadFilename\(delivery\.name\)/)
  assert.match(read('src/lib/supabase/service-role.ts'), /import 'server-only'/)
})

test('audit happens after signing and must succeed before the URL response', () => {
  const signIndex = route.indexOf('.createSignedUrl(')
  const auditIndex = route.indexOf("from('digital_download_logs').insert(")
  const responseIndex = route.indexOf('return json({ url: signed.data.signedUrl })')
  assert.ok(signIndex > -1 && auditIndex > signIndex && responseIndex > auditIndex)
  assert.match(route, /user_id: user\.id/)
  assert.match(route, /digital_access_id: delivery\.accessId/)
  assert.match(route, /file_path: delivery\.filePath/)
  assert.match(route, /if \(signed\.error[\s\S]*return json\([\s\S]*503\)/)
  assert.match(route, /if \(audit\.error\)[\s\S]*return json\([\s\S]*503\)/)
})

test('download response is private/no-store and exposes only the temporary URL', () => {
  assert.match(route, /Cache-Control', 'private, no-store'/)
  assert.match(route, /return json\(\{ url: signed\.data\.signedUrl \}\)/)
  const success = route.match(/return json\(\{ url: signed\.data\.signedUrl \}\)/)?.[0] ?? ''
  assert.doesNotMatch(success, /file_path|bucket|service|access/)
})

test('owned and successful checkout destinations point to My Library without changing checkout calls', () => {
  assert.equal((buyNow.match(/href="\/account\/library"/g) ?? []).length, 2)
  assert.match(buyNow, /fetch\('\/api\/vault\/orders'/)
  assert.match(buyNow, /fetch\('\/api\/payments\/razorpay\/orders'/)
  assert.match(buyNow, /fetch\('\/api\/payments\/razorpay\/verify'/)
})
