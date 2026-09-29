import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260929030000_vault_book_publication_readiness.sql')
const editor = read('src/app/admin/vault/products/product-editor.tsx')
const productActions = read('src/app/admin/vault/products/actions.ts')
const assetActions = read('src/app/admin/vault/products/book-pdf-actions.ts')

test('drafts, physical books, and courses remain outside the narrow readiness guard', () => {
  assert.match(migration, /new\.kind = 'book' and new\.is_active and new\.product_mode in \('digital', 'hybrid'\)/)
  assert.doesNotMatch(migration, /before insert[\s\S]*evo_vault_products/i)
  assert.match(migration, /New active books are checked only after subtype creation/)
})

test('activation and mode transitions require a normalized valid active PDF', () => {
  assert.match(migration, /before update of kind, is_active, product_mode/)
  assert.match(migration, /from public\.evo_vault_book_assets asset[\s\S]*asset\.is_active[\s\S]*asset\.mime_type = 'application\/pdf'[\s\S]*asset\.file_size > 0/)
  assert.match(migration, /EVO_VAULT_PUBLICATION_READINESS_REQUIRED/)
  assert.doesNotMatch(migration.slice(migration.indexOf('create or replace function public.enforce_evo_vault_product'), migration.indexOf('create or replace function public.enforce_evo_vault_book_asset')), /digital_file_path|digital_file_size/)
})

test('asset direct DML and RPC removal cannot remove the final valid deliverable', () => {
  assert.match(migration, /before update of is_active, mime_type, file_size or delete/)
  assert.match(migration, /asset\.id <> old\.id[\s\S]*asset\.is_active[\s\S]*asset\.mime_type = 'application\/pdf'[\s\S]*asset\.file_size > 0/)
  assert.match(migration, /p_operation = 'remove'[\s\S]*asset\.id <> target\.id[\s\S]*EVO_VAULT_PUBLICATION_READINESS_REQUIRED/)
  assert.ok(migration.indexOf('EVO_VAULT_PUBLICATION_READINESS_REQUIRED', migration.indexOf("p_operation = 'remove'")) < migration.indexOf('set is_active = false', migration.indexOf("p_operation = 'remove'")))
})

test('activation, upload, replacement, and removal share the book-row mutex', () => {
  const locks = migration.match(/from public\.evo_vault_books[^;]*for update/gs) ?? []
  assert.ok(locks.length >= 4, `expected lock coverage, found ${locks.length}`)
  assert.match(migration, /Existing books join the same per-book lock domain as every asset mutation/)
  assert.match(migration, /The subtype row is the common mutex/)
})

test('checkout uses normalized assets even when legacy book fields are populated', () => {
  const checkout = migration.slice(migration.indexOf('create or replace function public.create_pending_evo_vault_order'))
  assert.match(checkout, /from public\.evo_vault_book_assets as asset/)
  assert.match(checkout, /asset\.is_active[\s\S]*asset\.mime_type = 'application\/pdf'[\s\S]*asset\.file_size > 0/)
  assert.doesNotMatch(checkout, /digital_file_path|digital_file_size/)
})

test('function security, search paths, and grants preserve existing boundaries', () => {
  assert.match(migration, /save_evo_vault_product[\s\S]*security invoker[\s\S]*set search_path = public/)
  assert.match(migration, /mutate_evo_vault_book_asset[\s\S]*security invoker[\s\S]*set search_path = public/)
  assert.match(migration, /create_pending_evo_vault_order[\s\S]*security definer[\s\S]*set search_path = ''/)
  assert.match(migration, /revoke all on function public\.mutate_evo_vault_book_asset\(uuid, uuid, text, text\) from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.mutate_evo_vault_book_asset\(uuid, uuid, text, text\) to service_role/)
})

test('new products are drafts and readiness failures receive safe admin messages', () => {
  assert.match(editor, /defaultChecked=\{product\?\.is_active \?\? false\}/)
  assert.match(editor, /Save a draft, upload its PDF files, then activate it explicitly/)
  assert.match(productActions, /Add at least one PDF before activating this book\./)
  assert.match(assetActions, /An active digital book must keep at least one PDF\. Deactivate the book first or add another PDF\./)
})
