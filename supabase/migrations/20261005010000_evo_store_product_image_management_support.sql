-- Evo Store V1 Stage 1B Phase 2D: database support for product image management.

create policy evo_store_product_objects_staff_read on storage.objects
for select to authenticated
using (
  bucket_id = 'evo-store-products'
  and (select private.is_staff())
);

create or replace function private.guard_evo_store_archived_product_images()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row record;
begin
  -- Product lifecycle changes and image changes take the same parent-row lock.
  -- Sorting makes the unusual cross-product UPDATE lock both parents consistently.
  for product_row in
    select product.id, product.publication_status
    from public.evo_store_products product
    where product.id in (
      case when tg_op <> 'INSERT' then old.product_id end,
      case when tg_op <> 'DELETE' then new.product_id end
    )
    order by product.id
    for update
  loop
    if product_row.publication_status = 'archived'::public.evo_store_publication_status then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_IMAGE_ARCHIVED_PRODUCT';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_evo_store_archived_product_images()
  from public, anon, authenticated;

create trigger evo_store_product_images_guard_archived
before insert or update or delete on public.evo_store_product_images
for each row execute function private.guard_evo_store_archived_product_images();

drop policy evo_store_product_objects_staff_insert on storage.objects;
create policy evo_store_product_objects_staff_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'evo-store-products'
  and (select private.is_staff())
  and exists (
    select 1
    from public.evo_store_product_images image
    join public.evo_store_products product on product.id = image.product_id
    where image.storage_bucket = storage.objects.bucket_id
      and image.storage_path = storage.objects.name
      and product.publication_status <> 'archived'::public.evo_store_publication_status
  )
);

create or replace function public.set_evo_store_product_primary_image(
  p_product_id uuid,
  p_image_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_status public.evo_store_publication_status;
  target_active boolean;
begin
  if not coalesce(private.is_staff(), false) then
    raise exception using errcode = '42501', message = 'EVO_STORE_IMAGE_PRIMARY_UNAUTHORIZED';
  end if;

  select product.publication_status into product_status
  from public.evo_store_products product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'EVO_STORE_IMAGE_PRIMARY_PRODUCT_NOT_FOUND';
  end if;
  if product_status = 'archived'::public.evo_store_publication_status then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_IMAGE_ARCHIVED_PRODUCT';
  end if;

  select image.is_active into target_active
  from public.evo_store_product_images image
  where image.id = p_image_id and image.product_id = p_product_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'EVO_STORE_IMAGE_PRIMARY_IMAGE_NOT_FOUND';
  end if;
  if not target_active then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_IMAGE_PRIMARY_INACTIVE';
  end if;

  update public.evo_store_product_images image
  set is_primary = false
  where image.product_id = p_product_id
    and image.is_active
    and image.is_primary
    and image.id <> p_image_id;

  update public.evo_store_product_images image
  set is_primary = true
  where image.id = p_image_id and image.product_id = p_product_id;
end;
$$;

revoke all on function public.set_evo_store_product_primary_image(uuid, uuid)
  from public, anon;
grant execute on function public.set_evo_store_product_primary_image(uuid, uuid)
  to authenticated;

-- The supported Supabase Storage schema exposes this standard per-bucket limit.
-- Change only the existing private Store product bucket; do not recreate it.
update storage.buckets
set file_size_limit = 5 * 1024 * 1024
where id = 'evo-store-products';
