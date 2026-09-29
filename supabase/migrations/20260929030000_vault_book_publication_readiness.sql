-- Stage 3B: normalized book assets are the publication and checkout authority.
-- No production data is changed by this forward-only migration.

create or replace function public.enforce_evo_vault_product_publication_readiness()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- UPDATE-only is intentional: save_evo_vault_product creates the parent before its
  -- book subtype, then performs the first safe readiness check after subtype creation.
  if new.kind = 'book' and new.is_active and new.product_mode in ('digital', 'hybrid')
     and (old.is_active is distinct from new.is_active
       or old.product_mode is distinct from new.product_mode
       or old.kind is distinct from new.kind) then
    perform 1 from public.evo_vault_books
    where vault_product_id = new.id
    for update;

    if not exists (
      select 1 from public.evo_vault_book_assets asset
      where asset.vault_product_id = new.id
        and asset.is_active
        and asset.mime_type = 'application/pdf'
        and asset.file_size > 0
    ) then
      raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_evo_vault_book_asset_publication_readiness()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_id uuid := old.vault_product_id;
  removes_valid_pdf boolean;
begin
  removes_valid_pdf := old.is_active and old.mime_type = 'application/pdf' and old.file_size > 0
    and (tg_op = 'DELETE' or not (new.is_active and new.mime_type = 'application/pdf' and new.file_size > 0));
  if not removes_valid_pdf then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- The subtype row is the common mutex. Every path locks it before counting assets.
  perform 1 from public.evo_vault_books
  where vault_product_id = product_id
  for update;

  if exists (
    select 1 from public.evo_vault_products product
    where product.id = product_id and product.kind = 'book' and product.is_active
      and product.product_mode in ('digital', 'hybrid')
  ) and not exists (
    select 1 from public.evo_vault_book_assets asset
    where asset.vault_product_id = product_id
      and asset.id <> old.id
      and asset.is_active
      and asset.mime_type = 'application/pdf'
      and asset.file_size > 0
  ) then
    raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists enforce_evo_vault_product_publication_readiness on public.evo_vault_products;
create trigger enforce_evo_vault_product_publication_readiness
before update of kind, is_active, product_mode on public.evo_vault_products
for each row execute function public.enforce_evo_vault_product_publication_readiness();

drop trigger if exists enforce_evo_vault_book_asset_publication_readiness on public.evo_vault_book_assets;
create trigger enforce_evo_vault_book_asset_publication_readiness
before update of is_active, mime_type, file_size or delete on public.evo_vault_book_assets
for each row execute function public.enforce_evo_vault_book_asset_publication_readiness();

revoke all on function public.enforce_evo_vault_product_publication_readiness() from public, anon, authenticated;
revoke all on function public.enforce_evo_vault_book_asset_publication_readiness() from public, anon, authenticated;

-- Phase 3A compatibility: a null p_prices preserves obsolete override rows.
-- Arrays retain the previous behavior until the legacy table is removed.
create or replace function public.save_evo_vault_product(
  p_product_id uuid,
  p_parent jsonb,
  p_subtype jsonb,
  p_prices jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_id uuid;
  product_kind public.vault_product_kind;
  product_is_active boolean;
  base_currency text;
  base_amount numeric(14,2);
  price_row jsonb;
  price_currency text;
  price_amount numeric(14,2);
  seen_currencies text[] := array[]::text[];
  currency_order constant text[] := array['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY'];
begin
  if private.is_staff() is not true then
    raise exception using errcode = '42501', message = 'Staff authorization is required';
  end if;

  if p_parent is null or jsonb_typeof(p_parent) <> 'object'
     or p_subtype is null or jsonb_typeof(p_subtype) <> 'object' then
    raise exception using errcode = '22023', message = 'Product and subtype payloads must be objects';
  end if;
  if nullif(btrim(p_parent->>'name'), '') is null
     or nullif(btrim(p_parent->>'slug'), '') is null
     or nullif(btrim(p_parent->>'category_id'), '') is null
     or nullif(btrim(p_parent->>'product_mode'), '') is null
     or nullif(btrim(p_parent->>'price'), '') is null
     or nullif(btrim(p_parent->>'currency'), '') is null
     or jsonb_typeof(p_parent->'is_active') <> 'boolean'
     or jsonb_typeof(p_parent->'is_featured') <> 'boolean'
     or (p_parent->>'sort_order') !~ '^-?[0-9]+$' then
    raise exception using errcode = '22023', message = 'Product payload is incomplete or invalid';
  end if;

  product_kind := (p_parent->>'kind')::public.vault_product_kind;
  product_is_active := (p_parent->>'is_active')::boolean;
  perform (p_parent->>'category_id')::uuid;
  perform (p_parent->>'product_mode')::public.product_mode;
  perform (p_parent->>'sort_order')::integer;

  base_currency := upper(btrim(p_parent->>'currency'));
  if not (base_currency = any(currency_order)) then
    raise exception using errcode = '22023', message = 'Unsupported base currency';
  end if;
  if (p_parent->>'price') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
     or (base_currency = 'JPY' and (p_parent->>'price') !~ '^[0-9]+$') then
    raise exception using errcode = '22023', message = 'Invalid base price amount or currency precision';
  end if;
  base_amount := (p_parent->>'price')::numeric(14,2);
  if base_amount < 0 then
    raise exception using errcode = '22023', message = 'Base price cannot be negative';
  end if;

  if p_prices is not null then
    if jsonb_typeof(p_prices) <> 'array'
       or jsonb_array_length(p_prices) > cardinality(currency_order) - 1 then
      raise exception using errcode = '22023', message = 'Overrides must be an array of no more than nine prices';
    end if;

    for price_row in select value from jsonb_array_elements(p_prices)
    loop
      if jsonb_typeof(price_row) <> 'object'
         or jsonb_typeof(price_row->'is_active') <> 'boolean'
         or nullif(btrim(price_row->>'currency'), '') is null
         or nullif(btrim(price_row->>'amount'), '') is null then
        raise exception using errcode = '22023', message = 'Every override must contain currency, amount, and active status';
      end if;
      price_currency := upper(btrim(price_row->>'currency'));
      if not (price_currency = any(currency_order)) then
        raise exception using errcode = '22023', message = 'Unsupported override currency';
      end if;
      if price_currency = base_currency then
        raise exception using errcode = '22023', message = 'Override currency cannot equal the base currency';
      end if;
      if price_currency = any(seen_currencies) then
        raise exception using errcode = '22023', message = 'Duplicate override currency';
      end if;
      if (price_row->>'amount') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
         or (price_currency = 'JPY' and (price_row->>'amount') !~ '^[0-9]+$') then
        raise exception using errcode = '22023', message = 'Invalid override amount or currency precision';
      end if;
      price_amount := (price_row->>'amount')::numeric(14,2);
      if price_amount < 0 then
        raise exception using errcode = '22023', message = 'Override amount cannot be negative';
      end if;
      seen_currencies := array_append(seen_currencies, price_currency);
    end loop;
  end if;

  if p_product_id is not null then
    -- Existing books join the same per-book lock domain as every asset mutation.
    if product_kind = 'book' then
      perform 1 from public.evo_vault_books
      where vault_product_id = p_product_id
      for update;
    end if;

    perform 1 from public.evo_vault_products
    where id = p_product_id and kind = product_kind;
    if not found then
      raise exception using errcode = 'P0002', message = 'Vault product not found or kind mismatch';
    end if;
  end if;

  if p_product_id is null then
    insert into public.evo_vault_products (
      kind, category_id, name, slug, description, short_description, product_mode, price, currency,
      cover_image_url, is_active, is_featured, sort_order, seo_title, seo_description
    ) values (
      product_kind, (p_parent->>'category_id')::uuid, p_parent->>'name', p_parent->>'slug', p_parent->>'description', p_parent->>'short_description',
      (p_parent->>'product_mode')::public.product_mode, base_amount, base_currency,
      p_parent->>'cover_image_url', product_is_active, (p_parent->>'is_featured')::boolean,
      (p_parent->>'sort_order')::integer, p_parent->>'seo_title', p_parent->>'seo_description'
    ) returning id into saved_id;
  else
    update public.evo_vault_products set
      category_id = (p_parent->>'category_id')::uuid,
      name = p_parent->>'name', slug = p_parent->>'slug', description = p_parent->>'description',
      short_description = p_parent->>'short_description', product_mode = (p_parent->>'product_mode')::public.product_mode,
      price = base_amount, currency = base_currency, cover_image_url = p_parent->>'cover_image_url',
      is_active = product_is_active, is_featured = (p_parent->>'is_featured')::boolean,
      sort_order = (p_parent->>'sort_order')::integer, seo_title = p_parent->>'seo_title',
      seo_description = p_parent->>'seo_description', updated_at = now()
    where id = p_product_id and kind = product_kind
    returning id into saved_id;
  end if;

  if product_kind = 'book' then
    insert into public.evo_vault_books (vault_product_id, author_name, isbn, page_count, physical_weight_g, preview_text)
    values (saved_id, p_subtype->>'author_name', p_subtype->>'isbn', (p_subtype->>'page_count')::integer, (p_subtype->>'physical_weight_g')::integer, p_subtype->>'preview_text')
    on conflict (vault_product_id) do update set author_name = excluded.author_name, isbn = excluded.isbn,
      page_count = excluded.page_count, physical_weight_g = excluded.physical_weight_g,
      preview_text = excluded.preview_text, updated_at = now();
  else
    insert into public.evo_vault_courses (vault_product_id, instructor_id, subtitle, level, duration_minutes, certificate_available, preview_video_url)
    values (saved_id, (p_subtype->>'instructor_id')::uuid, p_subtype->>'subtitle', p_subtype->>'level',
      (p_subtype->>'duration_minutes')::integer, (p_subtype->>'certificate_available')::boolean, p_subtype->>'preview_video_url')
    on conflict (vault_product_id) do update set instructor_id = excluded.instructor_id, subtitle = excluded.subtitle,
      level = excluded.level, duration_minutes = excluded.duration_minutes, certificate_available = excluded.certificate_available,
      preview_video_url = excluded.preview_video_url, updated_at = now();
  end if;

  -- New active books are checked only after subtype creation; failure rolls back the parent insert.
  if product_kind = 'book' and product_is_active
     and (p_parent->>'product_mode')::public.product_mode in ('digital', 'hybrid')
     and not exists (
       select 1 from public.evo_vault_book_assets asset
       where asset.vault_product_id = saved_id
         and asset.is_active
         and asset.mime_type = 'application/pdf'
         and asset.file_size > 0
     ) then
    raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
  end if;

  if p_prices is not null then
    insert into public.evo_vault_product_prices (vault_product_id, currency, amount, is_active)
    select saved_id, upper(btrim(value->>'currency')), (value->>'amount')::numeric(14,2), (value->>'is_active')::boolean
    from jsonb_array_elements(p_prices) submitted(value)
    on conflict (vault_product_id, currency) do update set
      amount = excluded.amount, is_active = excluded.is_active, updated_at = now();

    delete from public.evo_vault_product_prices
    where vault_product_id = saved_id
      and not (upper(btrim(currency::text)) = any(seen_currencies));
  end if;

  return saved_id;
end;
$$;

revoke all on function public.save_evo_vault_product(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.save_evo_vault_product(uuid, jsonb, jsonb, jsonb) from anon;
grant execute on function public.save_evo_vault_product(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.mutate_evo_vault_book_asset(
  p_product_id uuid,
  p_asset_id uuid,
  p_operation text,
  p_title text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target public.evo_vault_book_assets%rowtype;
  swap_id uuid;
  preferred_primary uuid;
begin
  perform 1 from public.evo_vault_books where vault_product_id = p_product_id for update;
  select * into target from public.evo_vault_book_assets
  where id = p_asset_id and vault_product_id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Book asset not found'; end if;

  if p_operation = 'rename' then
    if nullif(btrim(p_title), '') is null then raise exception using errcode = '22023', message = 'Asset title is required'; end if;
    update public.evo_vault_book_assets set title = btrim(p_title) where id = target.id;
  elsif p_operation = 'primary' then
    if not target.is_active then raise exception using errcode = '22023', message = 'Inactive assets cannot be primary'; end if;
    preferred_primary := target.id;
  elsif p_operation in ('up', 'down') then
    if not target.is_active then raise exception using errcode = '22023', message = 'Inactive assets cannot be reordered'; end if;
    select id into swap_id from public.evo_vault_book_assets
    where vault_product_id = p_product_id and is_active
      and case when p_operation = 'up' then sort_order < target.sort_order else sort_order > target.sort_order end
    order by case when p_operation = 'up' then sort_order end desc,
             case when p_operation = 'down' then sort_order end asc,
             created_at, id limit 1;
    if swap_id is not null then
      update public.evo_vault_book_assets set sort_order = target.sort_order where id = swap_id;
      update public.evo_vault_book_assets
      set sort_order = case when p_operation = 'up' then greatest(target.sort_order - 1, 0) else target.sort_order + 1 end
      where id = target.id;
    end if;
  elsif p_operation = 'remove' then
    if target.is_active and target.mime_type = 'application/pdf' and target.file_size > 0
       and exists (select 1 from public.evo_vault_products product
         where product.id = p_product_id and product.kind = 'book' and product.is_active
           and product.product_mode in ('digital', 'hybrid'))
       and not exists (select 1 from public.evo_vault_book_assets asset
         where asset.vault_product_id = p_product_id and asset.id <> target.id
           and asset.is_active and asset.mime_type = 'application/pdf' and asset.file_size > 0) then
      raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
    end if;
    update public.evo_vault_book_assets set is_active = false, is_primary = false where id = target.id;
  else
    raise exception using errcode = '22023', message = 'Unsupported asset operation';
  end if;

  perform public.normalize_evo_vault_book_assets(p_product_id, preferred_primary);
  return jsonb_build_object(
    'removed_file_path', case when p_operation = 'remove' then target.file_path else null end
  );
end;
$$;

-- Phase 3B: resolve a trusted currency snapshot while creating a Vault order.
-- This migration intentionally contains no commerce-row backfill or other data rewrite.
create or replace function public.create_pending_evo_vault_order(
  p_vault_product_id uuid,
  p_requested_currency text
)
returns table (
  order_id uuid,
  order_status public.order_status,
  payment_status public.payment_status,
  currency text,
  total_amount numeric,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_currency text := pg_catalog.upper(pg_catalog.btrim(p_requested_currency));
  v_product_name text;
  v_product_kind public.vault_product_kind;
  v_product_mode public.product_mode;
  v_product_price numeric;
  v_product_currency text;
  v_product_is_active boolean;
  v_fx_rate numeric;
  v_fx_fetched_at timestamptz;
  v_resolved_currency text;
  v_resolved_amount numeric;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to create an order.';
  end if;
  if p_vault_product_id is null then
    raise exception using errcode = '22023', message = 'A Vault product is required.';
  end if;
  if v_requested_currency is null
    or v_requested_currency = ''
    or v_requested_currency not in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY') then
    raise exception using errcode = '22023', message = 'Requested currency is unsupported.';
  end if;

  select product.name, product.kind, product.product_mode, product.price,
    pg_catalog.upper(pg_catalog.btrim(product.currency::text)), product.is_active
  into v_product_name, v_product_kind, v_product_mode, v_product_price,
    v_product_currency, v_product_is_active
  from public.evo_vault_products as product
  where product.id = p_vault_product_id;

  if not found or v_product_is_active is not true then
    raise exception 'This Vault product is unavailable.';
  end if;
  if v_product_kind is distinct from 'book' then
    raise exception 'Only digital books are currently available for checkout.';
  end if;
  if v_product_mode is distinct from 'digital' then
    raise exception 'This product is not eligible for digital checkout.';
  end if;
  if v_product_price is null or v_product_price <= 0 then
    raise exception 'Free products are not supported by paid checkout.';
  end if;

  if not exists (
    select 1 from public.evo_vault_book_assets as asset
    where asset.vault_product_id = p_vault_product_id
      and asset.is_active
      and asset.mime_type = 'application/pdf'
      and asset.file_size > 0
  ) then
    raise exception 'This digital book is not ready for delivery.';
  end if;

  if exists (
    select 1 from public.digital_access as access
    where access.user_id = v_user_id
      and access.vault_product_id = p_vault_product_id
      and access.status = 'active'
      and (access.expires_at is null or access.expires_at > pg_catalog.now())
  ) then
    raise exception 'You already have access to this product.';
  end if;

  v_resolved_currency := v_requested_currency;
  if v_requested_currency = v_product_currency then
    v_resolved_amount := v_product_price;
  elsif v_product_currency = 'USD' then
    select rate.rate, rate.fetched_at
    into v_fx_rate, v_fx_fetched_at
    from public.currency_exchange_rates as rate
    where rate.base_currency = 'USD'
      and rate.quote_currency = v_requested_currency;

    if not found then
      raise exception 'No trusted FX rate is available for the requested currency.';
    end if;
    if v_fx_rate is null or v_fx_rate <= 0 then
      raise exception 'The trusted FX rate is invalid.';
    end if;
    if v_fx_fetched_at is null or v_fx_fetched_at > pg_catalog.now() + interval '5 minutes' then
      raise exception 'The trusted FX rate has an invalid fetch timestamp.';
    end if;
    if v_fx_fetched_at < pg_catalog.now() - interval '72 hours' then
      raise exception 'The trusted FX rate has expired.';
    end if;

    v_resolved_amount := case
      when v_requested_currency = 'JPY' then pg_catalog.round(v_product_price * v_fx_rate, 0)
      else pg_catalog.round(v_product_price * v_fx_rate, 2)
    end;
  else
    raise exception 'Automatic conversion from this product currency is unsupported.';
  end if;

  if v_resolved_amount is null or v_resolved_amount <= 0 then
    raise exception 'The resolved checkout amount is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(
      pg_catalog.md5(v_user_id::text || ':' || p_vault_product_id::text), 1, 16
    ))::bit(64)::bigint)
  );

  select candidate.id into v_order_id
  from public.orders as candidate
  where candidate.user_id = v_user_id
    and candidate.status = 'pending'
    and candidate.payment_status = 'pending'
    and candidate.subtotal = v_resolved_amount
    and candidate.discount_amount = 0
    and candidate.shipping_amount = 0
    and candidate.tax_amount = 0
    and candidate.total_amount = v_resolved_amount
    and candidate.currency::text = v_resolved_currency
    and (select pg_catalog.count(*) from public.order_items as counted_item
      where counted_item.order_id = candidate.id) = 1
    and exists (
      select 1 from public.order_items as matching_item
      where matching_item.order_id = candidate.id
        and matching_item.source = 'evo_vault'
        and matching_item.vault_product_id = p_vault_product_id
        and matching_item.store_variant_id is null
        and matching_item.quantity = 1
        and matching_item.unit_price = v_resolved_amount
        and matching_item.discount_amount = 0
        and matching_item.total_price = v_resolved_amount
    )
  order by candidate.created_at desc, candidate.id desc
  limit 1;

  if v_order_id is not null then
    return query select reusable.id, reusable.status, reusable.payment_status,
      reusable.currency::text, reusable.total_amount, false
    from public.orders as reusable where reusable.id = v_order_id;
    return;
  end if;

  insert into public.orders (
    user_id, coupon_id, status, payment_status, subtotal, discount_amount,
    shipping_amount, tax_amount, total_amount, currency, address_id
  ) values (
    v_user_id, null, 'pending', 'pending', v_resolved_amount, 0,
    0, 0, v_resolved_amount, v_resolved_currency, null
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, source, vault_product_id, store_variant_id, product_name_snapshot,
    sku_snapshot, quantity, unit_price, discount_amount, total_price, metadata
  ) values (
    v_order_id, 'evo_vault', p_vault_product_id, null, v_product_name,
    null, 1, v_resolved_amount, 0, v_resolved_amount, '{}'::jsonb
  );

  return query select inserted_order.id, inserted_order.status,
    inserted_order.payment_status, inserted_order.currency::text,
    inserted_order.total_amount, true
  from public.orders as inserted_order where inserted_order.id = v_order_id;
end;
$$;

revoke all on function public.create_pending_evo_vault_order(uuid, text) from public;
revoke all on function public.create_pending_evo_vault_order(uuid, text) from anon;
grant execute on function public.create_pending_evo_vault_order(uuid, text) to authenticated;

comment on function public.create_pending_evo_vault_order(uuid, text) is
  'Creates or reuses an immutable trusted-currency pending order for an authenticated customer purchasing a deliverable digital Vault book.';


revoke all on function public.mutate_evo_vault_book_asset(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.mutate_evo_vault_book_asset(uuid, uuid, text, text) to service_role;

comment on function public.enforce_evo_vault_product_publication_readiness() is
  'UPDATE-only boundary guard; subtype creation timing is handled atomically by save_evo_vault_product.';
comment on function public.enforce_evo_vault_book_asset_publication_readiness() is
  'Prevents direct DML from removing the final normalized deliverable of an active digital/hybrid book.';
