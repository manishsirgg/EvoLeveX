import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL(
  '../supabase/migrations/20261005010000_evo_store_product_image_management_support.sql',
  import.meta.url,
), 'utf8')

test('staff object reads remain private and bucket scoped', () => {
  assert.match(migration, /create policy evo_store_product_objects_staff_read on storage\.objects[\s\S]*for select to authenticated[\s\S]*bucket_id = 'evo-store-products'[\s\S]*private\.is_staff\(\)/)
  assert.doesNotMatch(migration, /update storage\.buckets[\s\S]*public\s*=\s*true/i)
})

test('archived image guard locks the owning product and covers every mutation', () => {
  assert.match(migration, /before insert or update or delete on public\.evo_store_product_images/)
  assert.match(migration, /from public\.evo_store_products product[\s\S]*order by product\.id[\s\S]*for update/)
  assert.match(migration, /EVO_STORE_IMAGE_ARCHIVED_PRODUCT/)
})

test('storage inserts retain exact metadata matching and reject archived owners', () => {
  assert.match(migration, /create policy evo_store_product_objects_staff_insert[\s\S]*image\.storage_bucket = storage\.objects\.bucket_id[\s\S]*image\.storage_path = storage\.objects\.name[\s\S]*product\.publication_status <> 'archived'/)
})

test('primary transition RPC is hardened and client authorization is narrow', () => {
  assert.match(migration, /create or replace function public\.set_evo_store_product_primary_image/)
  assert.match(migration, /security definer\s+set search_path = ''/)
  assert.match(migration, /private\.is_staff\(\)/)
  assert.match(migration, /where product\.id = p_product_id\s+for update/)
  assert.match(migration, /where image\.id = p_image_id and image\.product_id = p_product_id/)
  assert.match(migration, /revoke all on function public\.set_evo_store_product_primary_image\(uuid, uuid\)[\s\S]*from public, anon/)
  assert.match(migration, /grant execute on function public\.set_evo_store_product_primary_image\(uuid, uuid\)[\s\S]*to authenticated/)
  assert.doesNotMatch(migration, /grant execute[\s\S]*to service_role/i)
})

test('the existing private bucket receives only the supported 5 MiB size limit', () => {
  assert.match(migration, /update storage\.buckets\s+set file_size_limit = 5 \* 1024 \* 1024\s+where id = 'evo-store-products'/i)
  assert.doesNotMatch(migration, /insert into storage\.buckets/i)
})
