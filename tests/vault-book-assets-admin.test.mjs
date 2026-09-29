import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { logVaultBookAssetFailure, safeVaultDiagnosticField } from '../src/lib/vault-book-asset-diagnostics.ts'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const foundation = read('supabase/migrations/20260929000000_evo_vault_book_assets.sql')
const migration = read('supabase/migrations/20260929010000_admin_vault_book_asset_management.sql')
const actions = read('src/app/admin/vault/products/book-pdf-actions.ts')
const manager = read('src/app/admin/vault/products/book-pdf-manager.tsx')
const loader = read('src/lib/admin-vault-book-assets.ts')
const serviceRole = read('src/lib/supabase/service-role.ts')
const customerRoute = read('src/app/api/vault/books/download/route.ts')
const access = read('src/lib/vault-access.ts')
const diagnostics = read('src/lib/vault-book-asset-diagnostics.ts')

test('multiple assets retain product ownership, stable IDs, and required titles', () => {
  assert.match(foundation, /vault_product_id uuid not null/)
  assert.match(foundation, /check \(btrim\(title\) <> ''\)/)
  assert.match(migration, /insert into public\.evo_vault_book_assets/)
  assert.match(migration, /update public\.evo_vault_book_assets[\s\S]*where id = p_asset_id/)
})

test('PDF type, size, and managed product namespace are independently verified', () => {
  assert.match(manager, /file\.type !== 'application\/pdf'/)
  assert.match(manager, /PDF_SIGNATURE/)
  assert.match(actions, /object\.data\?\.contentType !== 'application\/pdf'/)
  assert.match(migration, /\^vault\/'[\s\S]*p_product_id::text[\s\S]*\/books\//)
})

test('ordering is normalized and active assets have exactly one primary', () => {
  assert.match(migration, /row_number\(\) over \(order by sort_order, created_at, id\) - 1/)
  assert.match(migration, /set is_primary = false/)
  assert.match(migration, /set is_primary = true[\s\S]*where id = selected_primary_id/)
  assert.match(foundation, /evo_vault_book_assets_one_active_primary_idx/)
})

test('primary selection synchronizes legacy fields while secondary additions preserve it', () => {
  assert.match(migration, /digital_file_path = primary_asset\.file_path/)
  assert.match(migration, /digital_file_size = primary_asset\.file_size/)
  assert.match(migration, /p_preferred_primary_id is null and asset\.is_primary/)
  assert.match(migration, /coalesce\(max\(sort_order\) \+ 1, 0\)/)
})

test('replacement is atomic before old-object cleanup and keeps secondary replacements secondary', () => {
  const rpcIndex = actions.indexOf("rpc('finalize_evo_vault_book_asset_upload'")
  const cleanupIndex = actions.indexOf('previousPath', rpcIndex)
  assert.ok(rpcIndex >= 0 && cleanupIndex > rpcIndex)
  assert.match(migration, /set title = btrim\(p_title\), file_path = p_file_path, file_size = p_file_size/)
  assert.doesNotMatch(migration, /set title = btrim\(p_title\)[^;]*is_primary/s)
})

test('removal deactivates first and deterministically promotes a remaining asset', () => {
  assert.match(migration, /set is_active = false, is_primary = false/)
  assert.match(migration, /order by asset\.sort_order, asset\.created_at, asset\.id/)
  assert.match(actions, /removedPath[\s\S]*removeManagedObject/)
})

test('unchanged edits cannot duplicate assets and backfilled assets load naturally', () => {
  const productActions = read('src/app/admin/vault/products/actions.ts')
  assert.doesNotMatch(productActions, /evo_vault_book_assets/)
  assert.match(foundation, /'Book PDF'[\s\S]*true,[\s\S]*true/)
  assert.match(loader, /from\('evo_vault_book_assets'\)/)
})

test('asset CRUD remains service-role-only and every action reauthorizes staff', () => {
  assert.match(foundation, /revoke all on table public\.evo_vault_book_assets from anon, authenticated/)
  assert.match(migration, /revoke all on function public\.mutate_evo_vault_book_asset[\s\S]*authenticated/)
  assert.match(actions, /await requireAdmin\(\)/)
  assert.match(actions, /createServiceRoleClient\(\)\.rpc/)
  assert.match(serviceRole, /import 'server-only'/)
  assert.doesNotMatch(manager, /service-role|SUPABASE_SERVICE_ROLE_KEY/)
})

test('customer delivery contract and product-level entitlement remain unchanged', () => {
  assert.match(customerRoute, /productId/)
  assert.doesNotMatch(customerRoute, /assetId|evo_vault_book_assets/)
  assert.match(access, /from\('digital_access'\)/)
  assert.doesNotMatch(access, /asset_id/)
})

test('admin UI supports multi-select, titles, ordering, replacement, and no raw paths', () => {
  assert.match(manager, /Digital Book Files/)
  assert.match(manager, /multiple required/)
  assert.match(manager, /Customer-facing title/)
  assert.match(manager, /Make Primary/)
  assert.match(manager, /Replace PDF/)
  assert.match(manager, /Remove PDF/)
  assert.doesNotMatch(manager, /asset\.file_path|asset\.filePath|href=.*filename/)
})

test('server diagnostics identify each upload and mutation failure stage', () => {
  for (const stage of [
    'authorization/staff verification',
    'upload-session creation',
    'Storage upload',
    'uploaded-object verification',
    'finalize_evo_vault_book_asset_upload RPC',
    'cleanup/removal after failed finalization',
    'unexpected server exception',
    'mutate_evo_vault_book_asset RPC',
    'replacement previous-object removal',
    'removed-object cleanup',
  ]) assert.match(actions, new RegExp(stage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const operation of ['replacement', 'rename', 'primary', 'reordering', 'removal']) assert.match(actions, new RegExp(`['"]${operation}['"]`))
})

test('diagnostics retain safe provider fields and redact paths, URLs, and credentials', () => {
  for (const field of ['code', 'message', 'details', 'hint', 'productId', 'assetId']) assert.match(diagnostics, new RegExp(`\\b${field}\\b`))
  assert.match(diagnostics, /REDACTED_STORAGE_PATH/)
  assert.match(diagnostics, /REDACTED_URL/)
  assert.match(diagnostics, /REDACTED_TOKEN/)
  assert.match(diagnostics, /REDACTED_SECRET/)
  assert.doesNotMatch(actions, /console\.error/)

  const unsafe = 'vault/123e4567-e89b-12d3-a456-426614174000/books/private.pdf https://signed.example/file?token=secret Bearer abc123 eyJabc.def.ghi'
  const sanitized = safeVaultDiagnosticField(unsafe)
  assert.doesNotMatch(sanitized, /private\.pdf|signed\.example|abc123|eyJabc/)

  const calls = []
  const originalError = console.error
  console.error = (...args) => calls.push(args)
  try {
    logVaultBookAssetFailure({
      operation: 'add', stage: 'finalize RPC', productId: 'product-id',
      error: { code: '23505', message: 'safe conflict', details: unsafe, hint: 'safe hint' },
    })
  } finally {
    console.error = originalError
  }
  assert.deepEqual(calls[0][1], {
    operation: 'add', stage: 'finalize RPC', code: '23505', message: 'safe conflict',
    details: '[REDACTED_STORAGE_PATH] [REDACTED_URL] Bearer [REDACTED] [REDACTED_TOKEN]',
    hint: 'safe hint', productId: 'product-id', assetId: null,
  })
})

test('failed finalization remains generic and cleanup follows the logged RPC failure', () => {
  const failure = actions.indexOf("stage: 'finalize_evo_vault_book_asset_upload RPC'")
  const cleanup = actions.indexOf("'cleanup/removal after failed finalization'", failure)
  assert.ok(failure >= 0 && cleanup > failure)
  assert.match(actions, /The PDF could not be attached\. Existing files were preserved and the new upload was removed\./)
  assert.doesNotMatch(manager, /finalize_evo_vault_book_asset_upload|mutate_evo_vault_book_asset|error\.details|error\.hint/)
})
