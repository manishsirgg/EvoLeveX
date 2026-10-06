-- Phase 2J-B: transactional Store reservations only. No orders/payments/expiry batch.
-- Archived catalog still owns live holds. Permit only a reservation decrement;
-- physical stock, thresholds, ownership, INSERT and DELETE retain their guard.
create or replace function private.guard_evo_store_archived_product_inventory()
returns trigger language plpgsql security definer set search_path = '' as $$
declare product_row record;
begin
  for product_row in
    select product.id, product.publication_status from public.evo_store_products product
    where product.id in (
      select variant.product_id from public.evo_store_variants variant
      where variant.id in (case when tg_op <> 'INSERT' then old.variant_id end,
                           case when tg_op <> 'DELETE' then new.variant_id end)
    ) order by product.id for update
  loop
    if product_row.publication_status = 'archived'::public.evo_store_publication_status then
      if tg_op = 'UPDATE' then
        if new.quantity_reserved < old.quantity_reserved
           and (pg_catalog.to_jsonb(new) - 'quantity_reserved' - 'updated_at')
             = (pg_catalog.to_jsonb(old) - 'quantity_reserved' - 'updated_at') then
          continue;
        end if;
      end if;
      raise exception using errcode = 'P0001', message = 'EVO_STORE_INVENTORY_ARCHIVED_PRODUCT';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_evo_store_archived_product_inventory() from public, anon, authenticated;

-- Called only by the definer RPCs, after user/header serialization. For lazy
-- expiry, lock the UNION of old/new products and inventory before either effect.
create function private.lock_evo_store_checkout_inventory(p_variants uuid[], p_snapshot_products uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare owners jsonb; current_owners jsonb;
begin
  select coalesce(pg_catalog.jsonb_object_agg(v.id::text, v.product_id::text), '{}'::jsonb)
    into owners from public.evo_store_variants v where v.id = any(p_variants);
  perform p.id from public.evo_store_products p
    where p.id = any(p_snapshot_products) or p.id in (
      select value::uuid from pg_catalog.jsonb_each_text(owners)
    ) order by p.id for update;
  select coalesce(pg_catalog.jsonb_object_agg(v.id::text, v.product_id::text), '{}'::jsonb)
    into current_owners from public.evo_store_variants v where v.id = any(p_variants);
  if current_owners <> owners then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_STATE_CONFLICT';
  end if;
  perform i.variant_id from public.evo_store_inventory i
    where i.variant_id = any(p_variants) order by i.variant_id for update;
end;
$$;
revoke all on function private.lock_evo_store_checkout_inventory(uuid[], uuid[]) from public, anon, authenticated, service_role;

-- Header and complete product/inventory lock set must already be held.
create function private.finish_evo_store_checkout_hold(p_checkout uuid, p_status public.evo_store_checkout_status)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('released', 'expired') then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_STATE_CONFLICT';
  end if;
  if not exists (select 1 from public.evo_store_checkout_items item where item.checkout_id = p_checkout)
    or exists (
      select 1 from public.evo_store_checkout_items item
      left join public.evo_store_inventory inventory on inventory.variant_id = item.variant_id
      where item.checkout_id = p_checkout
        and (inventory.variant_id is null or inventory.quantity_reserved < item.quantity)
    ) then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_RECONCILIATION_REQUIRED';
  end if;
  update public.evo_store_inventory inventory
    set quantity_reserved = inventory.quantity_reserved - item.quantity
    from public.evo_store_checkout_items item
    where item.checkout_id = p_checkout and inventory.variant_id = item.variant_id;
  update public.evo_store_checkouts checkout
    set status = p_status,
        released_at = case when p_status = 'released' then pg_catalog.transaction_timestamp() end,
        expired_at = case when p_status = 'expired' then pg_catalog.transaction_timestamp() end
    where checkout.id = p_checkout and checkout.status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_STATE_CONFLICT';
  end if;
end;
$$;
revoke all on function private.finish_evo_store_checkout_hold(uuid, public.evo_store_checkout_status) from public, anon, authenticated, service_role;

-- Explicit allowlist DTO: no fingerprint, inventory, internal user or service data.
create function private.evo_store_checkout_result(p_checkout uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'id', c.id, 'status', c.status, 'currency', c.currency, 'subtotal', c.subtotal,
    'discount_total', c.discount_total, 'shipping_total', c.shipping_total,
    'tax_total', c.tax_total, 'grand_total', c.grand_total,
    'created_at', c.created_at, 'expires_at', c.expires_at,
    'released_at', c.released_at, 'expired_at', c.expired_at, 'consumed_at', c.consumed_at,
    'shipping', pg_catalog.jsonb_build_object(
      'full_name', c.shipping_full_name, 'phone', c.shipping_phone,
      'address_line1', c.shipping_address_line1, 'address_line2', c.shipping_address_line2,
      'landmark', c.shipping_landmark, 'city', c.shipping_city, 'state', c.shipping_state,
      'postal_code', c.shipping_postal_code, 'country', c.shipping_country),
    'items', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', i.id, 'variant_id', i.variant_id, 'product_id', i.product_id,
      'quantity', i.quantity, 'currency', i.currency, 'unit_price', i.unit_price,
      'line_subtotal', i.line_subtotal, 'product_name', i.product_name,
      'variant_name', i.variant_name, 'sku', i.sku, 'size_code', i.size_code,
      'color_code', i.color_code) order by i.variant_id), '[]'::jsonb)
      from public.evo_store_checkout_items i where i.checkout_id = c.id)
  ) from public.evo_store_checkouts c where c.id = p_checkout;
$$;
revoke all on function private.evo_store_checkout_result(uuid) from public, anon, authenticated, service_role;

create function public.create_evo_store_checkout(
  p_items jsonb, p_currency text, p_idempotency_key uuid, p_address_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  customer uuid := auth.uid();
  currency_code text := pg_catalog.upper(pg_catalog.btrim(p_currency));
  entry jsonb; variant_uuid uuid; qty integer;
  variants uuid[] := '{}'::uuid[];
  canonical jsonb := '[]'::jsonb;
  fingerprint text;
  existing public.evo_store_checkouts%rowtype;
  active_checkout public.evo_store_checkouts%rowtype;
  address_row public.addresses%rowtype;
  line record;
  snapshots jsonb := '[]'::jsonb;
  subtotal_value numeric := 0;
  checkout_uuid uuid;
  locked_variants uuid[]; snapshot_products uuid[];
begin
  if customer is null then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_AUTH_REQUIRED';
  end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_INVALID_ITEM';
  end if;
  if pg_catalog.jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_EMPTY';
  end if;
  if pg_catalog.jsonb_array_length(p_items) > 50 then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_TOO_MANY_LINES';
  end if;
  for entry in select value from pg_catalog.jsonb_array_elements(p_items) loop
    if pg_catalog.jsonb_typeof(entry) <> 'object'
      or not (entry ? 'variant_id' and entry ? 'quantity')
      or (entry - 'variant_id' - 'quantity') <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(entry -> 'variant_id') <> 'string'
      or (entry ->> 'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_INVALID_ITEM';
    end if;
    variant_uuid := (entry ->> 'variant_id')::uuid;
    if pg_catalog.jsonb_typeof(entry -> 'quantity') <> 'number' then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_INVALID_QUANTITY';
    end if;
    if (entry ->> 'quantity')::numeric <> pg_catalog.trunc((entry ->> 'quantity')::numeric)
      or (entry ->> 'quantity')::numeric not between 1 and 10 then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_INVALID_QUANTITY';
    end if;
    qty := (entry ->> 'quantity')::numeric::integer;
    if variant_uuid = any(variants) then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_DUPLICATE_VARIANT';
    end if;
    variants := pg_catalog.array_append(variants, variant_uuid);
    canonical := canonical || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', variant_uuid, 'quantity', qty));
  end loop;
  if currency_code is null or not private.evo_store_currency_supported(currency_code) then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_CURRENCY_INVALID';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_IDEMPOTENCY_INVALID';
  end if;
  if p_address_id is null then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_ADDRESS_INVALID';
  end if;
  select pg_catalog.jsonb_agg(value order by (value ->> 'variant_id')::uuid)
    into canonical from pg_catalog.jsonb_array_elements(canonical);
  -- Store canonical JSON itself: deterministic and free of digest collisions.
  fingerprint := pg_catalog.jsonb_build_object('currency', currency_code,
    'address_id', p_address_id, 'items', canonical)::text;
  -- User-wide boundary is stronger than user/key: distinct keys cannot race the
  -- one-active index. Release uses the identical namespace before its header.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evo_store_checkout:user:' || customer::text, 0));
  select * into existing from public.evo_store_checkouts c
    where c.user_id = customer and c.idempotency_key = p_idempotency_key for update;
  if found then
    if existing.request_fingerprint <> fingerprint then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_IDEMPOTENCY_CONFLICT';
    end if;
    return private.evo_store_checkout_result(existing.id);
  end if;
  select * into active_checkout from public.evo_store_checkouts c
    where c.user_id = customer and c.status = 'active' for update;
  if found and active_checkout.expires_at > pg_catalog.transaction_timestamp() then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_ACTIVE_EXISTS';
  end if;
  select * into address_row from public.addresses a
    where a.id = p_address_id and a.user_id = customer for share;
  if not found or address_row.full_name !~ '[^[:space:]]' or address_row.phone !~ '[^[:space:]]'
    or address_row.address_line1 !~ '[^[:space:]]' or address_row.city !~ '[^[:space:]]'
    or address_row.state !~ '[^[:space:]]' or address_row.postal_code !~ '[^[:space:]]'
    or address_row.country !~ '[^[:space:]]' then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_ADDRESS_INVALID';
  end if;
  select pg_catalog.array_agg(distinct id) into locked_variants from (
    select pg_catalog.unnest(variants) as id
    union select i.variant_id from public.evo_store_checkout_items i where i.checkout_id = active_checkout.id
  ) combined;
  select coalesce(pg_catalog.array_agg(distinct i.product_id), '{}'::uuid[]) into snapshot_products
    from public.evo_store_checkout_items i where i.checkout_id = active_checkout.id;
  perform private.lock_evo_store_checkout_inventory(locked_variants, snapshot_products);
  if active_checkout.id is not null then
    perform private.finish_evo_store_checkout_hold(active_checkout.id, 'expired');
  end if;
  for line in
    select v.id, v.product_id, v.is_active, v.weight_g, v.name as variant_name, v.sku,
      v.size_code, v.color_code, p.name as product_name, p.publication_status, p.product_mode,
      p.is_active as product_active, price.amount, price.is_active as price_active,
      inventory.variant_id as inventory_id, inventory.quantity_on_hand, inventory.quantity_reserved,
      (request.value ->> 'quantity')::integer as quantity
    from pg_catalog.jsonb_array_elements(canonical) request
    left join public.evo_store_variants v on v.id = (request.value ->> 'variant_id')::uuid
    left join public.evo_store_products p on p.id = v.product_id
    left join public.evo_store_variant_prices price on price.variant_id = v.id and price.currency = currency_code
    left join public.evo_store_inventory inventory on inventory.variant_id = v.id
    order by (request.value ->> 'variant_id')::uuid
  loop
    if line.id is null then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_INVALID_VARIANT';
    end if;
    if not line.is_active or not line.product_active or line.publication_status <> 'published'
      or line.product_mode <> 'physical' or line.weight_g is null or line.weight_g <= 0
      or line.inventory_id is null
      or line.product_name !~ '[^[:space:]]' or line.sku !~ '[^[:space:]]' then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_UNAVAILABLE';
    end if;
    if line.amount is null or not line.price_active then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_PRICE_MISSING';
    end if;
    if line.amount <= 0 or line.amount = 'NaN'::numeric
      or (currency_code = 'JPY' and line.amount <> pg_catalog.trunc(line.amount)) then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_PRICE_INVALID';
    end if;
    if private.evo_store_product_readiness_error(line.product_id) is not null then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_UNAVAILABLE';
    end if;
    if line.quantity_on_hand - line.quantity_reserved < line.quantity then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_OUT_OF_STOCK';
    end if;
    subtotal_value := subtotal_value + line.quantity * line.amount;
    snapshots := snapshots || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'variant_id', line.id, 'product_id', line.product_id, 'quantity', line.quantity,
      'unit_price', line.amount, 'line_subtotal', line.quantity * line.amount,
      'product_name', line.product_name, 'variant_name', line.variant_name, 'sku', line.sku,
      'size_code', line.size_code, 'color_code', line.color_code));
  end loop;
  if subtotal_value > 999999999999.99 then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_PRICE_INVALID';
  end if;
  insert into public.evo_store_checkouts (
    user_id, idempotency_key, request_fingerprint, status, currency, subtotal, discount_total,
    shipping_total, tax_total, grand_total, address_id, shipping_full_name, shipping_phone,
    shipping_address_line1, shipping_address_line2, shipping_landmark, shipping_city,
    shipping_state, shipping_postal_code, shipping_country, created_at, updated_at, expires_at
  ) values (customer, p_idempotency_key, fingerprint, 'active', currency_code, subtotal_value, 0,
    null, null, null, p_address_id, address_row.full_name, address_row.phone,
    address_row.address_line1, address_row.address_line2, address_row.landmark, address_row.city,
    address_row.state, address_row.postal_code, address_row.country,
    pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp(),
    pg_catalog.transaction_timestamp() + interval '30 minutes') returning id into checkout_uuid;
  insert into public.evo_store_checkout_items (
    checkout_id, variant_id, product_id, quantity, currency, unit_price, line_subtotal,
    product_name, variant_name, sku, size_code, color_code
  ) select checkout_uuid, (s ->> 'variant_id')::uuid, (s ->> 'product_id')::uuid,
    (s ->> 'quantity')::integer, currency_code, (s ->> 'unit_price')::numeric,
    (s ->> 'line_subtotal')::numeric, s ->> 'product_name', s ->> 'variant_name',
    s ->> 'sku', s ->> 'size_code', s ->> 'color_code'
    from pg_catalog.jsonb_array_elements(snapshots) s;
  update public.evo_store_inventory inventory
    set quantity_reserved = inventory.quantity_reserved + item.quantity
    from public.evo_store_checkout_items item
    where item.checkout_id = checkout_uuid and inventory.variant_id = item.variant_id;
  return private.evo_store_checkout_result(checkout_uuid);
exception
  when integrity_constraint_violation or data_exception or deadlock_detected or serialization_failure then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_STATE_CONFLICT';
end;
$$;

create function public.release_evo_store_checkout(p_checkout_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare customer uuid := auth.uid(); checkout public.evo_store_checkouts%rowtype;
  variants uuid[]; products uuid[];
begin
  if customer is null then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_AUTH_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evo_store_checkout:user:' || customer::text, 0));
  select * into checkout from public.evo_store_checkouts c
    where c.id = p_checkout_id and c.user_id = customer for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_NOT_FOUND';
  end if;
  if checkout.status = 'consumed' then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_ALREADY_CONSUMED';
  end if;
  if checkout.status in ('released', 'expired') then
    return private.evo_store_checkout_result(checkout.id);
  end if;
  select pg_catalog.array_agg(i.variant_id), pg_catalog.array_agg(distinct i.product_id)
    into variants, products from public.evo_store_checkout_items i where i.checkout_id = checkout.id;
  perform private.lock_evo_store_checkout_inventory(variants, products);
  perform private.finish_evo_store_checkout_hold(checkout.id, 'released');
  return private.evo_store_checkout_result(checkout.id);
exception
  when integrity_constraint_violation or data_exception or deadlock_detected or serialization_failure then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_CHECKOUT_STATE_CONFLICT';
end;
$$;
revoke all on function public.create_evo_store_checkout(jsonb, text, uuid, uuid) from public, anon, service_role;
revoke all on function public.release_evo_store_checkout(uuid) from public, anon, service_role;
grant execute on function public.create_evo_store_checkout(jsonb, text, uuid, uuid) to authenticated;
grant execute on function public.release_evo_store_checkout(uuid) to authenticated;
