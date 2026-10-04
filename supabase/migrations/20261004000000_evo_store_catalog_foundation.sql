-- Evo Store V1 Stage 1A: physical catalog publication, media, variants, and prices.
-- Existing Store catalog tables were verified empty before this forward-only migration.

create type public.evo_store_publication_status as enum ('draft', 'published', 'archived');

alter table public.evo_store_products
  add column publication_status public.evo_store_publication_status not null default 'draft';

create or replace function private.project_evo_store_product_is_active()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.is_active := new.publication_status = 'published'::public.evo_store_publication_status;
  return new;
end;
$$;

create trigger evo_store_products_project_is_active
before insert or update of publication_status, is_active on public.evo_store_products
for each row execute function private.project_evo_store_product_is_active();

alter table public.evo_store_products
  add constraint evo_store_products_is_active_projection_check
  check (is_active = (publication_status = 'published'::public.evo_store_publication_status));

create index evo_store_products_publication_order_idx
  on public.evo_store_products (publication_status, sort_order, created_at, id);

create table public.evo_store_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.evo_store_products(id) on delete cascade,
  storage_bucket text not null default 'evo-store-products',
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evo_store_product_images_bucket_check
    check (storage_bucket = 'evo-store-products'),
  constraint evo_store_product_images_path_check check (
    storage_path = product_id::text || '/' || split_part(storage_path, '/', 2)
    and storage_path ~ ('^' || product_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$')
  ),
  constraint evo_store_product_images_sort_order_check check (sort_order >= 0),
  constraint evo_store_product_images_storage_object_key unique (storage_bucket, storage_path)
);

create unique index evo_store_product_images_one_active_primary_idx
  on public.evo_store_product_images (product_id)
  where is_active and is_primary;

create index evo_store_product_images_product_order_idx
  on public.evo_store_product_images (product_id, is_active, sort_order, created_at, id);

create trigger evo_store_product_images_updated_at
before update on public.evo_store_product_images
for each row execute function public.set_updated_at();

alter table public.evo_store_variants
  add column size_code text,
  add column color_code text;

create or replace function private.normalize_evo_store_variant_codes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.sku := pg_catalog.upper(pg_catalog.btrim(new.sku));
  new.size_code := pg_catalog.upper(nullif(pg_catalog.btrim(new.size_code), ''));
  new.color_code := pg_catalog.upper(nullif(pg_catalog.btrim(new.color_code), ''));
  return new;
end;
$$;

create trigger evo_store_variants_normalize_codes
before insert or update of sku, size_code, color_code on public.evo_store_variants
for each row execute function private.normalize_evo_store_variant_codes();

alter table public.evo_store_variants
  add constraint evo_store_variants_sku_format_check
    check (sku ~ '^[A-Z0-9][A-Z0-9._/-]{0,63}$'),
  add constraint evo_store_variants_size_code_format_check
    check (size_code is null or size_code ~ '^[A-Z0-9][A-Z0-9._/-]{0,31}$'),
  add constraint evo_store_variants_color_code_format_check
    check (color_code is null or color_code ~ '^[A-Z0-9][A-Z0-9._/-]{0,31}$'),
  add constraint evo_store_variants_product_dimensions_key
    unique nulls not distinct (product_id, size_code, color_code);

create index evo_store_variants_product_active_order_idx
  on public.evo_store_variants (product_id, is_active, sort_order, id);

create table public.evo_store_variant_prices (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.evo_store_variants(id) on delete cascade,
  currency character(3) not null,
  amount numeric(14,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evo_store_variant_prices_amount_check check (amount >= 0),
  constraint evo_store_variant_prices_currency_supported_check check (
    currency in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY')
  ),
  constraint evo_store_variant_prices_jpy_integral_check check (
    currency <> 'JPY' or amount = trunc(amount)
  ),
  constraint evo_store_variant_prices_variant_currency_key unique (variant_id, currency)
);

create index evo_store_variant_prices_variant_active_idx
  on public.evo_store_variant_prices (variant_id, is_active, currency);

create trigger evo_store_variant_prices_updated_at
before update on public.evo_store_variant_prices
for each row execute function public.set_updated_at();

comment on table public.evo_store_variant_prices is
  'Authoritative merchant-defined Store variant prices; never browser or live-FX amounts.';
comment on column public.evo_store_products.is_active is
  'Compatibility projection maintained from publication_status; not a publication authority.';
comment on column public.evo_store_products.base_price is
  'Compatibility/display value; not an authoritative Store variant price.';
comment on column public.evo_store_variants.price is
  'Compatibility/read value; evo_store_variant_prices is authoritative.';

create or replace function private.evo_store_product_readiness_error(p_product_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  product_row public.evo_store_products%rowtype;
begin
  select * into product_row
  from public.evo_store_products
  where id = p_product_id;

  if not found or product_row.publication_status <> 'published'::public.evo_store_publication_status then
    return null;
  end if;
  if product_row.product_mode <> 'physical'::public.product_mode then
    return 'EVO_STORE_READY_PHYSICAL_REQUIRED';
  end if;
  if product_row.category_id is null or not exists (
    select 1 from public.evo_store_categories category
    where category.id = product_row.category_id and category.is_active
  ) then
    return 'EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED';
  end if;
  if not exists (
    select 1 from public.evo_store_product_images image
    where image.product_id = p_product_id and image.is_active
  ) then
    return 'EVO_STORE_READY_IMAGE_REQUIRED';
  end if;
  if (select count(*) from public.evo_store_product_images image
      where image.product_id = p_product_id and image.is_active and image.is_primary) <> 1 then
    return 'EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED';
  end if;
  if not exists (
    select 1 from public.evo_store_variants variant
    where variant.product_id = p_product_id and variant.is_active
  ) then
    return 'EVO_STORE_READY_ACTIVE_VARIANT_REQUIRED';
  end if;
  if exists (
    select 1 from public.evo_store_variants variant
    where variant.product_id = p_product_id and variant.is_active
      and (variant.weight_g is null or variant.weight_g <= 0)
  ) then
    return 'EVO_STORE_READY_VARIANT_WEIGHT_REQUIRED';
  end if;
  if exists (
    select 1 from public.evo_store_variants variant
    where variant.product_id = p_product_id and variant.is_active
      and not exists (
        select 1 from public.evo_store_inventory inventory
        where inventory.variant_id = variant.id
      )
  ) then
    return 'EVO_STORE_READY_VARIANT_INVENTORY_REQUIRED';
  end if;
  if exists (
    select 1 from public.evo_store_variants variant
    where variant.product_id = p_product_id and variant.is_active
      and not exists (
        select 1 from public.evo_store_variant_prices price
        where price.variant_id = variant.id and price.is_active and price.amount > 0
      )
  ) then
    return 'EVO_STORE_READY_VARIANT_PRICE_REQUIRED';
  end if;
  return null;
end;
$$;

create or replace function private.assert_evo_store_product_ready(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  readiness_error text;
begin
  perform 1 from public.evo_store_products where id = p_product_id for update;
  if not found then
    return;
  end if;
  readiness_error := private.evo_store_product_readiness_error(p_product_id);
  if readiness_error is not null then
    raise exception using errcode = 'P0001', message = readiness_error;
  end if;
end;
$$;

create or replace function private.enforce_evo_store_product_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_product_id uuid;
  new_product_id uuid;
begin
  if tg_table_name = 'evo_store_products' then
    if tg_op <> 'DELETE' then perform private.assert_evo_store_product_ready(new.id); end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  elsif tg_table_name = 'evo_store_product_images' or tg_table_name = 'evo_store_variants' then
    if tg_op <> 'INSERT' then old_product_id := old.product_id; end if;
    if tg_op <> 'DELETE' then new_product_id := new.product_id; end if;
  elsif tg_table_name = 'evo_store_variant_prices' or tg_table_name = 'evo_store_inventory' then
    if tg_op <> 'INSERT' then
      select product_id into old_product_id from public.evo_store_variants
      where id = old.variant_id;
    end if;
    if tg_op <> 'DELETE' then
      select product_id into new_product_id from public.evo_store_variants
      where id = new.variant_id;
    end if;
  end if;

  if old_product_id is not null then perform private.assert_evo_store_product_ready(old_product_id); end if;
  if new_product_id is not null and new_product_id is distinct from old_product_id then
    perform private.assert_evo_store_product_ready(new_product_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.enforce_evo_store_category_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_id uuid;
begin
  for product_id in
    select product.id from public.evo_store_products product
    where product.category_id = old.id
      and product.publication_status = 'published'::public.evo_store_publication_status
  loop
    perform private.assert_evo_store_product_ready(product_id);
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create constraint trigger evo_store_products_readiness
after insert or update on public.evo_store_products
deferrable initially deferred for each row
execute function private.enforce_evo_store_product_readiness();

create constraint trigger evo_store_categories_readiness
after update or delete on public.evo_store_categories
deferrable initially deferred for each row
execute function private.enforce_evo_store_category_readiness();

create constraint trigger evo_store_product_images_readiness
after insert or update or delete on public.evo_store_product_images
deferrable initially deferred for each row
execute function private.enforce_evo_store_product_readiness();

create constraint trigger evo_store_variants_readiness
after insert or update or delete on public.evo_store_variants
deferrable initially deferred for each row
execute function private.enforce_evo_store_product_readiness();

create constraint trigger evo_store_variant_prices_readiness
after insert or update or delete on public.evo_store_variant_prices
deferrable initially deferred for each row
execute function private.enforce_evo_store_product_readiness();

create constraint trigger evo_store_inventory_readiness
after insert or update or delete on public.evo_store_inventory
deferrable initially deferred for each row
execute function private.enforce_evo_store_product_readiness();

revoke all on function private.project_evo_store_product_is_active() from public, anon, authenticated;
revoke all on function private.normalize_evo_store_variant_codes() from public, anon, authenticated;
revoke all on function private.evo_store_product_readiness_error(uuid) from public, anon, authenticated;
revoke all on function private.assert_evo_store_product_ready(uuid) from public, anon, authenticated;
revoke all on function private.enforce_evo_store_product_readiness() from public, anon, authenticated;
revoke all on function private.enforce_evo_store_category_readiness() from public, anon, authenticated;

alter table public.evo_store_product_images enable row level security;
alter table public.evo_store_variant_prices enable row level security;

drop policy if exists evo_store_products_public_read on public.evo_store_products;
create policy evo_store_products_public_read on public.evo_store_products
for select to anon, authenticated
using (publication_status = 'published' and is_active = true);

drop policy if exists evo_store_variants_public_read on public.evo_store_variants;
create policy evo_store_variants_public_read on public.evo_store_variants
for select to anon, authenticated
using (
  is_active = true and exists (
    select 1 from public.evo_store_products product
    where product.id = evo_store_variants.product_id
      and product.publication_status = 'published' and product.is_active = true
  )
);

create policy evo_store_product_images_public_read on public.evo_store_product_images
for select to anon, authenticated
using (
  is_active = true and exists (
    select 1 from public.evo_store_products product
    where product.id = evo_store_product_images.product_id
      and product.publication_status = 'published' and product.is_active = true
  )
);

create policy evo_store_product_images_staff_manage on public.evo_store_product_images
to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

create policy evo_store_variant_prices_public_read on public.evo_store_variant_prices
for select to anon, authenticated
using (
  is_active = true and exists (
    select 1
    from public.evo_store_variants variant
    join public.evo_store_products product on product.id = variant.product_id
    where variant.id = evo_store_variant_prices.variant_id
      and variant.is_active = true
      and product.publication_status = 'published' and product.is_active = true
  )
);

create policy evo_store_variant_prices_staff_manage on public.evo_store_variant_prices
to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

revoke all on table public.evo_store_product_images from anon, authenticated;
grant select on table public.evo_store_product_images to anon;
grant select, insert, update, delete on table public.evo_store_product_images to authenticated;

revoke all on table public.evo_store_variant_prices from anon, authenticated;
grant select on table public.evo_store_variant_prices to anon;
grant select, insert, update, delete on table public.evo_store_variant_prices to authenticated;

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'evo-store-products',
  'evo-store-products',
  false,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
);

create policy evo_store_product_objects_public_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'evo-store-products' and exists (
    select 1
    from public.evo_store_product_images image
    join public.evo_store_products product on product.id = image.product_id
    where image.storage_bucket = storage.objects.bucket_id
      and image.storage_path = storage.objects.name
      and image.is_active = true
      and product.publication_status = 'published' and product.is_active = true
  )
);

create policy evo_store_product_objects_staff_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'evo-store-products'
  and (select private.is_staff())
  and exists (
    select 1 from public.evo_store_product_images image
    where image.storage_bucket = storage.objects.bucket_id
      and image.storage_path = storage.objects.name
  )
);

create policy evo_store_product_objects_staff_update on storage.objects
for update to authenticated
using (bucket_id = 'evo-store-products' and (select private.is_staff()))
with check (
  bucket_id = 'evo-store-products'
  and (select private.is_staff())
  and exists (
    select 1 from public.evo_store_product_images image
    where image.storage_bucket = storage.objects.bucket_id
      and image.storage_path = storage.objects.name
  )
);

create policy evo_store_product_objects_staff_delete on storage.objects
for delete to authenticated
using (bucket_id = 'evo-store-products' and (select private.is_staff()));
