-- Phase 3B: resolve a trusted currency snapshot while creating a Vault order.
-- This migration intentionally contains no commerce-row backfill or other data rewrite.
revoke all on function public.create_pending_evo_vault_order(uuid) from public;
revoke all on function public.create_pending_evo_vault_order(uuid) from anon;
revoke all on function public.create_pending_evo_vault_order(uuid) from authenticated;
drop function public.create_pending_evo_vault_order(uuid);

create function public.create_pending_evo_vault_order(
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
    select 1 from public.evo_vault_books as book
    where book.vault_product_id = p_vault_product_id
      and book.digital_file_path is not null
      and pg_catalog.btrim(book.digital_file_path) <> ''
      and book.digital_file_size is not null
      and book.digital_file_size > 0
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

-- Reserve from the immutable order/item snapshot. Current catalog price and currency
-- deliberately do not participate after the order has been created.
create or replace function public.reserve_razorpay_payment(p_order_id uuid)
returns table (
  payment_id uuid, order_id uuid, amount numeric, currency text,
  provider_order_id text, created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_product public.evo_vault_products%rowtype;
  v_payment public.payments%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_order_id is null then
    raise exception using errcode = '22023', message = 'An order is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(pg_catalog.md5(p_order_id::text), 1, 16))::bit(64)::bigint)
  );

  select candidate.* into v_order from public.orders as candidate
  where candidate.id = p_order_id and candidate.user_id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order is unavailable.';
  end if;
  if v_order.status is distinct from 'pending' or v_order.payment_status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Order is not pending.';
  end if;
  if v_order.subtotal is null or v_order.total_amount is null
    or v_order.subtotal <= 0 or v_order.total_amount <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric then
    raise exception using errcode = 'P0001', message = 'Order totals are invalid.';
  end if;

  if (select pg_catalog.count(*) from public.order_items as counted
    where counted.order_id = p_order_id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Order items are invalid.';
  end if;
  select item.* into v_item from public.order_items as item where item.order_id = p_order_id;
  if v_item.source is distinct from 'evo_vault'
    or v_item.quantity is distinct from 1
    or v_item.vault_product_id is null
    or v_item.store_variant_id is not null
    or v_item.discount_amount is distinct from 0::numeric
    or v_item.unit_price is distinct from v_order.subtotal
    or v_item.total_price is distinct from v_order.total_amount then
    raise exception using errcode = 'P0001', message = 'Order item is invalid.';
  end if;

  select product.* into v_product from public.evo_vault_products as product
  where product.id = v_item.vault_product_id;
  if not found or v_product.is_active is not true
    or v_product.kind is distinct from 'book'
    or v_product.product_mode is distinct from 'digital' then
    raise exception using errcode = 'P0001', message = 'Product is unavailable.';
  end if;
  if not exists (
    select 1 from public.evo_vault_books as book
    where book.vault_product_id = v_item.vault_product_id
      and book.digital_file_path is not null
      and pg_catalog.btrim(book.digital_file_path) <> ''
      and book.digital_file_size is not null and book.digital_file_size > 0
  ) then
    raise exception using errcode = 'P0001', message = 'Product deliverable is unavailable.';
  end if;
  if exists (
    select 1 from public.digital_access as access
    where access.user_id = v_user_id
      and access.vault_product_id = v_item.vault_product_id
      and access.status = 'active'
      and (access.expires_at is null or access.expires_at > pg_catalog.now())
  ) then
    raise exception using errcode = 'P0001', message = 'Product access already exists.';
  end if;

  select payment.* into v_payment from public.payments as payment
  where payment.order_id = p_order_id and payment.provider = 'razorpay';
  if found then
    if v_payment.status is distinct from 'pending'
      or v_payment.amount is distinct from v_order.total_amount
      or v_payment.currency::text is distinct from v_order.currency::text then
      raise exception using errcode = 'P0001', message = 'Existing payment requires reconciliation.';
    end if;
    return query select v_payment.id, v_payment.order_id, v_payment.amount,
      v_payment.currency::text, v_payment.provider_order_id, false;
    return;
  end if;

  insert into public.payments (
    order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, metadata
  ) values (
    p_order_id, 'razorpay', null, null, v_order.total_amount, v_order.currency,
    'pending', pg_catalog.jsonb_build_object('local_order_id', p_order_id)
  ) returning * into v_payment;

  return query select v_payment.id, v_payment.order_id, v_payment.amount,
    v_payment.currency::text, v_payment.provider_order_id, true;
end;
$$;

revoke all on function public.reserve_razorpay_payment(uuid) from public;
revoke all on function public.reserve_razorpay_payment(uuid) from anon;
grant execute on function public.reserve_razorpay_payment(uuid) to authenticated;

comment on function public.reserve_razorpay_payment(uuid) is
  'Validates an immutable customer digital-book order snapshot and reserves its single pending Razorpay payment relationship.';
