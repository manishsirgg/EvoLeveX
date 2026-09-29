import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { logVaultProductSaveFailure } from '../src/lib/vault-book-asset-diagnostics.ts'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260929040000_fix_vault_book_readiness_privilege_boundary.sql')
const actions = read('src/app/admin/vault/products/actions.ts')
const helperStart = migration.indexOf('create or replace function public.evo_vault_book_has_deliverable_pdf')
const helperEnd = migration.indexOf('create or replace function public.enforce_evo_vault_product_publication_readiness')
const helper = migration.slice(helperStart, helperEnd)
const triggerStart = helperEnd
const saveStart = migration.indexOf('create or replace function public.save_evo_vault_product')
const trigger = migration.slice(triggerStart, saveStart)
const save = migration.slice(saveStart)

test('boolean-only definer helper crosses the private asset boundary without exposing metadata', () => {
  assert.match(helper, /returns boolean[\s\S]*security definer[\s\S]*set search_path = ''/)
  assert.match(helper, /select exists \([\s\S]*vault_product_id = p_product_id[\s\S]*is_active = true[\s\S]*mime_type = 'application\/pdf'[\s\S]*file_size > 0/)
  assert.doesNotMatch(helper, /\binsert\b|\bupdate\b|\bdelete\b|\bcount\b|file_path|storage|title|asset\.id/i)
})

test('helper execution is narrow and does not grant authenticated asset SELECT', () => {
  assert.match(helper, /revoke all on function public\.evo_vault_book_has_deliverable_pdf\(uuid\) from public/)
  assert.match(helper, /revoke all on function public\.evo_vault_book_has_deliverable_pdf\(uuid\) from anon/)
  assert.match(helper, /grant execute on function public\.evo_vault_book_has_deliverable_pdf\(uuid\) to authenticated/)
  assert.doesNotMatch(migration, /grant\s+select[\s\S]*evo_vault_book_assets/i)
  assert.doesNotMatch(migration, /create\s+policy[\s\S]*evo_vault_book_assets/i)
})

test('active digital save and direct activation use the helper rather than invoker table SELECT', () => {
  assert.match(save, /security invoker[\s\S]*set search_path = public/)
  assert.match(save, /product_is_active[\s\S]*product_mode'\)::public\.product_mode in \('digital', 'hybrid'\)[\s\S]*not public\.evo_vault_book_has_deliverable_pdf\(saved_id\)/)
  assert.doesNotMatch(save, /from public\.evo_vault_book_assets/)
  assert.match(trigger, /security invoker[\s\S]*new\.is_active[\s\S]*new\.product_mode in \('digital', 'hybrid'\)[\s\S]*not public\.evo_vault_book_has_deliverable_pdf\(new\.id\)/)
  assert.doesNotMatch(trigger, /from public\.evo_vault_book_assets/)
  assert.match(save, /p_prices is not null/)
  assert.match(save, /EVO_VAULT_PUBLICATION_READINESS_REQUIRED/)
})

test('the Aligned price-only update path keeps null legacy prices and logs bounded diagnostics', () => {
  assert.match(actions, /p_product_id: id, p_parent: parent, p_subtype: subtype, p_prices: null/)
  assert.match(actions, /operation: id \? 'update' : 'create'/)
  assert.match(actions, /stage: 'save_evo_vault_product RPC'/)
  const diagnosticCall = actions.slice(actions.indexOf('    logVaultProductSaveFailure({'), actions.indexOf('    return fail(', actions.indexOf('    logVaultProductSaveFailure({')))
  assert.doesNotMatch(diagnosticCall, /p_parent|p_subtype|FormData|parent,|subtype,/)

  const calls = []
  const originalError = console.error
  console.error = (...args) => calls.push(args)
  try {
    logVaultProductSaveFailure({ operation: 'update', stage: 'save_evo_vault_product RPC', productId: 'book-id', error: {
      code: '42501', message: 'https://private.example/file', details: 'vault/123e4567-e89b-12d3-a456-426614174000/books/private.pdf', hint: 'Bearer secret',
    } })
  } finally { console.error = originalError }
  assert.deepEqual(calls[0][1], {
    operation: 'update', stage: 'save_evo_vault_product RPC', productId: 'book-id', code: '42501',
    message: '[REDACTED_URL]', details: '[REDACTED_STORAGE_PATH]', hint: 'Bearer [REDACTED]',
  })
})

test('trusted final-PDF and checkout guards remain normalized and unchanged in Stage 3B', () => {
  const stage3b = read('supabase/migrations/20260929030000_vault_book_publication_readiness.sql')
  assert.match(stage3b, /enforce_evo_vault_book_asset_publication_readiness[\s\S]*asset\.id <> old\.id[\s\S]*EVO_VAULT_PUBLICATION_READINESS_REQUIRED/)
  assert.match(stage3b, /mutate_evo_vault_book_asset[\s\S]*asset\.id <> target\.id[\s\S]*EVO_VAULT_PUBLICATION_READINESS_REQUIRED/)
  assert.match(stage3b, /create_pending_evo_vault_order[\s\S]*from public\.evo_vault_book_assets as asset[\s\S]*This digital book is not ready for delivery/)
})
