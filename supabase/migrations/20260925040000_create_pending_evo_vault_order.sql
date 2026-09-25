-- Creates or reuses one trusted local pending order for an authenticated customer.
-- All commercial values come from database state; payment and entitlement are outside this primitive.
create or replace function public.create_pending_evo_vault_order(
  p_vault_product_id uuid
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
  v_product_name text;
  v_product_kind public.vault_product_kind;
  v_product_mode public.product_mode;
  v_product_price numeric;
  v_product_currency text;
  v_product_is_active boolean;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to create an order.';
  end if;

  if p_vault_product_id is null then
    raise exception 'A Vault product is required.';
  end if;

  select
    product.name,
    product.kind,
    product.product_mode,
    product.price,
    product.currency::text,
    product.is_active
  into
    v_product_name,
    v_product_kind,
    v_product_mode,
    v_product_price,
    v_product_currency,
    v_product_is_active
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
    select 1
    from public.evo_vault_books as book
    where book.vault_product_id = p_vault_product_id
      and book.digital_file_path is not null
      and pg_catalog.btrim(book.digital_file_path) <> ''
      and book.digital_file_size is not null
      and book.digital_file_size > 0
  ) then
    raise exception 'This digital book is not ready for delivery.';
  end if;

  if exists (
    select 1
    from public.digital_access as access
    where access.user_id = v_user_id
      and access.vault_product_id = p_vault_product_id
      and access.status = 'active'
      and (access.expires_at is null or access.expires_at > pg_catalog.now())
  ) then
    raise exception 'You already have access to this product.';
  end if;

  -- MD5's defined byte sequence supplies a stable signed 64-bit lock key for the UUID pair.
  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(
      pg_catalog.md5(v_user_id::text || ':' || p_vault_product_id::text),
      1,
      16
    ))::bit(64)::bigint)
  );

  select candidate.id
  into v_order_id
  from public.orders as candidate
  where candidate.user_id = v_user_id
    and candidate.status = 'pending'
    and candidate.payment_status = 'pending'
    and candidate.subtotal = v_product_price
    and candidate.discount_amount = 0
    and candidate.shipping_amount = 0
    and candidate.tax_amount = 0
    and candidate.total_amount = v_product_price
    and candidate.currency::text = v_product_currency
    and (
      select pg_catalog.count(*)
      from public.order_items as counted_item
      where counted_item.order_id = candidate.id
    ) = 1
    and exists (
      select 1
      from public.order_items as matching_item
      where matching_item.order_id = candidate.id
        and matching_item.source = 'evo_vault'
        and matching_item.vault_product_id = p_vault_product_id
        and matching_item.quantity = 1
        and matching_item.unit_price = v_product_price
        and matching_item.discount_amount = 0
        and matching_item.total_price = v_product_price
    )
  order by candidate.created_at desc, candidate.id desc
  limit 1;

  if v_order_id is not null then
    return query
    select
      reusable.id,
      reusable.status,
      reusable.payment_status,
      reusable.currency::text,
      reusable.total_amount,
      false
    from public.orders as reusable
    where reusable.id = v_order_id;
    return;
  end if;

  insert into public.orders (
    user_id,
    address_id,
    coupon_id,
    status,
    payment_status,
    subtotal,
    discount_amount,
    shipping_amount,
    tax_amount,
    total_amount,
    currency,
    shipping_name,
    shipping_phone,
    shipping_address1,
    shipping_address2,
    shipping_city,
    shipping_state,
    shipping_postal_code,
    shipping_country,
    notes
  )
  values (
    v_user_id,
    null,
    null,
    'pending',
    'pending',
    v_product_price,
    0,
    0,
    0,
    v_product_price,
    v_product_currency,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    source,
    vault_product_id,
    store_variant_id,
    product_name_snapshot,
    sku_snapshot,
    quantity,
    unit_price,
    discount_amount,
    total_price,
    metadata
  )
  values (
    v_order_id,
    'evo_vault',
    p_vault_product_id,
    null,
    v_product_name,
    null,
    1,
    v_product_price,
    0,
    v_product_price,
    '{}'::jsonb
  );

  return query
  select
    inserted_order.id,
    inserted_order.status,
    inserted_order.payment_status,
    inserted_order.currency::text,
    inserted_order.total_amount,
    true
  from public.orders as inserted_order
  where inserted_order.id = v_order_id;
end;
$$;

revoke all on function public.create_pending_evo_vault_order(uuid) from public;
revoke all on function public.create_pending_evo_vault_order(uuid) from anon;
grant execute on function public.create_pending_evo_vault_order(uuid) to authenticated;

comment on function public.create_pending_evo_vault_order(uuid) is
  'Creates or reuses one trusted pending order for an authenticated customer purchasing a paid, deliverable digital Vault book.';
