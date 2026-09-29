-- Forward fix for Stage 3B's private normalized-asset privilege boundary.
-- This migration intentionally changes no asset-table grants, RLS policies, or data.

create or replace function public.evo_vault_book_has_deliverable_pdf(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evo_vault_book_assets as asset
    where asset.vault_product_id = p_product_id
      and asset.is_active = true
      and asset.mime_type = 'application/pdf'
      and asset.file_size > 0
  );
$$;

-- The helper reveals one readiness bit, never rows or metadata. Authenticated execution
-- is required by the invoker-rights save RPC and product trigger; table SELECT stays revoked.
revoke all on function public.evo_vault_book_has_deliverable_pdf(uuid) from public;
revoke all on function public.evo_vault_book_has_deliverable_pdf(uuid) from anon;
grant execute on function public.evo_vault_book_has_deliverable_pdf(uuid) to authenticated;
grant execute on function public.evo_vault_book_has_deliverable_pdf(uuid) to service_role;

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

    if not public.evo_vault_book_has_deliverable_pdf(new.id) then
      raise exception using errcode = 'P0001', message = 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_evo_vault_product_publication_readiness() from public, anon, authenticated;

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
     and not public.evo_vault_book_has_deliverable_pdf(saved_id) then
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
