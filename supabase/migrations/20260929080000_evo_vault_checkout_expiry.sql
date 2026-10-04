-- Stage 3F-P1-002: bound Evo Vault checkout snapshots without deleting history.

alter table public.orders
  add column checkout_expires_at timestamptz,
  add column checkout_expired_at timestamptz;

-- Only Evo Vault snapshots receive a commercial deadline. Historical terminal states
-- retain their status; this backfill does not expire or fulfill anything.
update public.orders as orders
set checkout_expires_at = orders.created_at + interval '30 minutes'
where orders.checkout_expires_at is null
  and exists (select 1 from public.order_items as item
    where item.order_id = orders.id and item.source = 'evo_vault');

create index orders_expired_pending_checkout_idx
  on public.orders (checkout_expires_at, id)
  where status = 'pending' and payment_status = 'pending'
    and checkout_expires_at is not null;

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

  if not public.evo_vault_book_has_deliverable_pdf(p_vault_product_id) then
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

  -- The lock serializes retirement and replacement for this customer/product.
  -- A payment row is failed only while both sides are still genuinely pending.
  with expired as (
    update public.orders as stale
    set status = 'cancelled', payment_status = 'failed',
        checkout_expired_at = pg_catalog.now()
    where stale.user_id = v_user_id
      and stale.status = 'pending' and stale.payment_status = 'pending'
      and stale.checkout_expires_at <= pg_catalog.now()
      and exists (select 1 from public.order_items as stale_item
        where stale_item.order_id = stale.id
          and stale_item.source = 'evo_vault'
          and stale_item.vault_product_id = p_vault_product_id)
    returning stale.id
  )
  update public.payments as stale_payment
  set status = 'failed'
  from expired
  where stale_payment.order_id = expired.id and stale_payment.status = 'pending';

  select candidate.id into v_order_id
  from public.orders as candidate
  where candidate.user_id = v_user_id
    and candidate.status = 'pending'
    and candidate.payment_status = 'pending'
    and candidate.checkout_expires_at > pg_catalog.now()
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
    shipping_amount, tax_amount, total_amount, currency, address_id,
    checkout_expires_at
  ) values (
    v_user_id, null, 'pending', 'pending', v_resolved_amount, 0,
    0, 0, v_resolved_amount, v_resolved_currency, null,
    pg_catalog.now() + interval '30 minutes'
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

-- The result gains the authoritative deadline, so PostgreSQL requires a drop
-- before recreating this same input signature.
drop function public.reserve_razorpay_payment(uuid);
create function public.reserve_razorpay_payment(p_order_id uuid)
returns table (
  payment_id uuid, order_id uuid, amount numeric, currency text,
  provider_order_id text, checkout_expires_at timestamptz, created boolean
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
  if v_order.checkout_expires_at is null then
    raise exception using errcode = 'P0001', message = 'Order has no checkout deadline.';
  end if;
  if v_order.checkout_expires_at <= pg_catalog.now()
    and v_order.status = 'pending' and v_order.payment_status = 'pending' then
    update public.orders set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now() where id = v_order.id;
    update public.payments set status = 'failed'
      where order_id = v_order.id and status = 'pending';
    return;
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
  if not public.evo_vault_book_has_deliverable_pdf(v_item.vault_product_id) then
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
      v_payment.currency::text, v_payment.provider_order_id,
      v_order.checkout_expires_at, false;
    return;
  end if;

  insert into public.payments (
    order_id, provider, provider_order_id, provider_payment_id, amount, currency, status, metadata
  ) values (
    p_order_id, 'razorpay', null, null, v_order.total_amount, v_order.currency,
    'pending', pg_catalog.jsonb_build_object('local_order_id', p_order_id)
  ) returning * into v_payment;

  return query select v_payment.id, v_payment.order_id, v_payment.amount,
    v_payment.currency::text, v_payment.provider_order_id,
    v_order.checkout_expires_at, true;
end;
$$;

revoke all on function public.reserve_razorpay_payment(uuid) from public;
revoke all on function public.reserve_razorpay_payment(uuid) from anon;
grant execute on function public.reserve_razorpay_payment(uuid) to authenticated;

comment on function public.reserve_razorpay_payment(uuid) is
  'Validates an immutable customer digital-book order snapshot and reserves its single pending Razorpay payment relationship.';

-- The result gains an expiry classification for the provider-call race.
drop function public.attach_razorpay_order(uuid, text);
create function public.attach_razorpay_order(p_payment_id uuid, p_provider_order_id text)
returns table (
  payment_id uuid,
  order_id uuid,
  amount numeric,
  currency text,
  provider_order_id text,
  checkout_expired boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_provider_order_id text := pg_catalog.btrim(p_provider_order_id);
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_payment_id is null
    or v_provider_order_id is null
    or v_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$' then
    raise exception using errcode = '22023', message = 'Provider order ID is invalid.';
  end if;

  select payment.* into v_payment
  from public.payments as payment
  join public.orders as owned_order on owned_order.id = payment.order_id
  where payment.id = p_payment_id and owned_order.user_id = v_user_id
  for update of payment;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment is unavailable.';
  end if;
  select owned_order.* into v_order
  from public.orders as owned_order
  where owned_order.id = v_payment.order_id and owned_order.user_id = v_user_id
  for update;

  if v_payment.provider is distinct from 'razorpay'
    or (v_payment.status is distinct from 'pending'
      and not (v_payment.status = 'failed' and v_order.status = 'cancelled'
        and v_order.payment_status = 'failed' and v_order.checkout_expired_at is not null)) then
    raise exception using errcode = 'P0001', message = 'Payment is not eligible.';
  end if;

  -- Always preserve a first valid correlation, even if the provider call crossed
  -- the deadline. This prevents an orphaned provider order.
  if v_payment.provider_order_id is null then
    update public.payments
    set provider_order_id = v_provider_order_id
    where id = v_payment.id
    returning * into v_payment;
  elsif v_payment.provider_order_id is distinct from v_provider_order_id then
    raise exception using errcode = 'P0001', message = 'Provider order reconciliation conflict.';
  end if;

  if v_payment.status = 'failed' and v_order.checkout_expired_at is not null then
    return query select v_payment.id, v_payment.order_id, v_payment.amount,
      v_payment.currency::text, v_payment.provider_order_id, true;
    return;
  end if;

  if v_order.status = 'pending' and v_order.payment_status = 'pending'
    and v_order.checkout_expires_at <= pg_catalog.now() then
    update public.payments set status = 'failed' where id = v_payment.id returning * into v_payment;
    update public.orders set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now() where id = v_order.id;
    return query select v_payment.id, v_payment.order_id, v_payment.amount,
      v_payment.currency::text, v_payment.provider_order_id, true;
    return;
  end if;
  if v_order.status is distinct from 'pending' or v_order.payment_status is distinct from 'pending'
    or v_order.checkout_expires_at is null then
    raise exception using errcode = 'P0001', message = 'Order is not pending.';
  end if;

  return query select v_payment.id, v_payment.order_id, v_payment.amount,
    v_payment.currency::text, v_payment.provider_order_id, false;
end;
$$;

revoke all on function public.attach_razorpay_order(uuid, text) from public;
revoke all on function public.attach_razorpay_order(uuid, text) from anon;
grant execute on function public.attach_razorpay_order(uuid, text) to authenticated;

comment on function public.attach_razorpay_order(uuid, text) is
  'Idempotently attaches a Razorpay order ID to an owned pending payment without changing payment or order status.';


create or replace function public.reconcile_captured_razorpay_payment(
  p_provider_event_id text,
  p_payload_sha256 text,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_provider_amount bigint,
  p_provider_currency text
)
returns table (payment_id uuid, order_id uuid, processing_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_now timestamptz;
  v_expected_amount numeric;
begin
  if p_provider_event_id is null or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$'
    or p_provider_amount <= 0 or p_provider_currency not in
      ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY') then
    raise exception using errcode = '22023', message = 'Reconciliation input is invalid.';
  end if;

  select event.* into v_event from public.payment_webhook_events event
  where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id
  for update;
  if not found or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_order_id is distinct from p_provider_order_id
    or v_event.provider_payment_id is distinct from p_provider_payment_id then
    raise exception using errcode = 'P0001', message = 'Webhook event requires reconciliation.';
  end if;
  if v_event.processing_status = 'processed' then
    return query select v_event.payment_id, v_event.order_id, 'processed'::text;
    return;
  end if;
  if v_event.processing_status <> 'processing' then
    raise exception using errcode = 'P0001', message = 'Webhook event is not claimed.';
  end if;

  select payment.* into v_payment from public.payments payment
  where payment.provider = 'razorpay' and payment.provider_order_id = p_provider_order_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Payment is unavailable.'; end if;
  select candidate.* into v_order from public.orders candidate
  where candidate.id = v_payment.order_id for update;

  v_expected_amount := case when p_provider_currency = 'JPY'
    then v_payment.amount else v_payment.amount * 100 end;
  if v_payment.provider is distinct from 'razorpay'
    or v_payment.provider_order_id is distinct from p_provider_order_id
    or v_payment.amount is null or v_payment.amount <= 0
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.currency::text is distinct from v_order.currency::text
    or v_payment.currency::text is distinct from p_provider_currency
    or v_expected_amount is distinct from p_provider_amount::numeric
    or v_order.subtotal is null or v_order.subtotal <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  if (select pg_catalog.count(*) from public.order_items counted
      where counted.order_id = v_order.id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  select item.* into v_item from public.order_items item
  join public.evo_vault_products product on product.id = item.vault_product_id
  join public.evo_vault_books book on book.vault_product_id = product.id
  where item.order_id = v_order.id and item.source = 'evo_vault' and item.quantity = 1
    and item.vault_product_id is not null and item.store_variant_id is null
    and item.discount_amount = 0 and item.unit_price = v_order.subtotal
    and item.total_price = v_order.total_amount and product.kind = 'book'
    and product.product_mode = 'digital';
  if not found then raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.'; end if;

  if v_payment.provider_payment_id is not distinct from p_provider_payment_id
    and v_payment.status = 'paid' and v_payment.paid_at is not null
    and v_order.payment_status = 'paid' and v_order.status = 'confirmed'
    and v_order.confirmed_at is not null then
    null; -- Browser-first or duplicate webhook convergence.
  elsif v_payment.provider_payment_id is not null then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  elsif not (
      (v_payment.status = 'pending' and v_order.payment_status = 'pending' and v_order.status = 'pending')
      or (v_payment.status = 'failed' and v_order.payment_status = 'failed'
        and v_order.status = 'cancelled' and v_order.checkout_expired_at is not null
        and v_order.checkout_expires_at <= pg_catalog.now())
    ) then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  else
    v_now := pg_catalog.now();
    update public.payments set provider_payment_id = p_provider_payment_id,
      status = 'paid', paid_at = v_now where id = v_payment.id returning * into v_payment;
    update public.orders set payment_status = 'paid', status = 'confirmed',
      confirmed_at = v_now where id = v_order.id returning * into v_order;
  end if;

  perform public.fulfill_confirmed_evo_vault_order(v_order.id);
  update public.payment_webhook_events set processing_status = 'processed',
    processed_at = pg_catalog.now(), processing_error = null, safe_error_code = null,
    payment_id = v_payment.id, order_id = v_order.id
  where id = v_event.id;
  return query select v_payment.id, v_order.id, 'processed'::text;
end;
$$;

revoke all on function public.begin_razorpay_webhook_event(text,text,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.ignore_razorpay_webhook_event(text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.fail_razorpay_webhook_event(text,text,text) from public, anon, authenticated;
revoke all on function public.reconcile_captured_razorpay_payment(text,text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.begin_razorpay_webhook_event(text,text,jsonb,text,text,text) to service_role;
grant execute on function public.ignore_razorpay_webhook_event(text,text,jsonb,text) to service_role;
grant execute on function public.fail_razorpay_webhook_event(text,text,text) to service_role;
grant execute on function public.reconcile_captured_razorpay_payment(text,text,text,text,bigint,text) to service_role;

comment on function public.reconcile_captured_razorpay_payment(text,text,text,text,bigint,text) is
  'Service-only atomic Razorpay captured-payment reconciliation, Vault fulfillment, and webhook completion.';

-- Browser confirmation can call this only through a server-held service key and
-- only after the shared canonical Razorpay validator has accepted the payment.
-- It deliberately handles only expiry recovery; ordinary confirmation remains
-- on the authenticated confirm_razorpay_payment boundary.
create function public.recover_expired_captured_razorpay_payment(
  p_payment_id uuid, p_provider_order_id text, p_provider_payment_id text,
  p_provider_amount bigint, p_provider_currency text
)
returns table (payment_id uuid, order_id uuid, payment_status public.payment_status,
  order_status public.order_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_now timestamptz;
  v_expected_amount numeric;
begin
  if p_payment_id is null or p_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' or p_provider_amount <= 0
    or p_provider_currency not in ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY') then
    raise exception using errcode = '22023', message = 'Canonical payment input is invalid.';
  end if;
  select payment.* into v_payment from public.payments payment
    where payment.id = p_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Payment is unavailable.'; end if;
  select candidate.* into v_order from public.orders candidate
    where candidate.id = v_payment.order_id for update;
  v_expected_amount := case when p_provider_currency = 'JPY'
    then v_payment.amount else v_payment.amount * 100 end;
  if v_payment.provider is distinct from 'razorpay'
    or v_payment.provider_order_id is distinct from p_provider_order_id
    or v_payment.provider_payment_id is not null
    or v_payment.status is distinct from 'failed'
    or v_order.status is distinct from 'cancelled'
    or v_order.payment_status is distinct from 'failed'
    or v_order.checkout_expired_at is null
    or v_order.checkout_expires_at > pg_catalog.now()
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.currency::text is distinct from v_order.currency::text
    or v_payment.currency::text is distinct from p_provider_currency
    or v_expected_amount is distinct from p_provider_amount::numeric then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  if v_order.subtotal is null or v_order.subtotal <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric
    or (select pg_catalog.count(*) from public.order_items counted
      where counted.order_id = v_order.id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  select item.* into v_item from public.order_items item
  join public.evo_vault_products product on product.id = item.vault_product_id
  join public.evo_vault_books book on book.vault_product_id = product.id
  where item.order_id = v_order.id and item.source = 'evo_vault' and item.quantity = 1
    and item.vault_product_id is not null and item.store_variant_id is null
    and item.discount_amount = 0 and item.unit_price = v_order.subtotal
    and item.total_price = v_order.total_amount and product.kind = 'book'
    and product.product_mode = 'digital';
  if not found then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;
  v_now := pg_catalog.now();
  update public.payments set provider_payment_id = p_provider_payment_id,
    status = 'paid', paid_at = v_now where id = v_payment.id returning * into v_payment;
  update public.orders set status = 'confirmed', payment_status = 'paid',
    confirmed_at = v_now where id = v_order.id returning * into v_order;
  perform public.fulfill_confirmed_evo_vault_order(v_order.id);
  return query select v_payment.id, v_order.id, v_payment.status, v_order.status;
end;
$$;

revoke all on function public.recover_expired_captured_razorpay_payment(uuid,text,text,bigint,text)
  from public, anon, authenticated;
grant execute on function public.recover_expired_captured_razorpay_payment(uuid,text,text,bigint,text)
  to service_role;

create function public.expire_pending_evo_vault_checkouts(p_batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 500.';
  end if;
  with candidates as (
    select candidate.id from public.orders candidate
    where candidate.status = 'pending' and candidate.payment_status = 'pending'
      and candidate.checkout_expires_at <= pg_catalog.now()
      and exists (select 1 from public.order_items item where item.order_id = candidate.id
        and item.source = 'evo_vault')
    order by candidate.checkout_expires_at, candidate.id
    limit p_batch_size for update of candidate skip locked
  ), expired as (
    update public.orders stale set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now()
    from candidates where stale.id = candidates.id returning stale.id
  ), failed_payments as (
    update public.payments payment set status = 'failed' from expired
    where payment.order_id = expired.id and payment.status = 'pending' returning payment.id
  )
  select pg_catalog.count(*)::integer into v_count from expired;
  return v_count;
end;
$$;

revoke all on function public.expire_pending_evo_vault_checkouts(integer)
  from public, anon, authenticated;
grant execute on function public.expire_pending_evo_vault_checkouts(integer) to service_role;

comment on function public.expire_pending_evo_vault_checkouts(integer) is
  'Service-only bounded lazy cleanup for elapsed, still-unpaid Evo Vault checkout snapshots.';


create or replace function public.confirm_razorpay_payment(
  p_payment_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text
)
returns table (
  payment_id uuid,
  order_id uuid,
  provider_order_id text,
  provider_payment_id text,
  payment_status public.payment_status,
  order_status public.order_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_provider_order_id text := pg_catalog.btrim(p_provider_order_id);
  v_provider_payment_id text := pg_catalog.btrim(p_provider_payment_id);
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_now timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_payment_id is null
    or v_provider_order_id is null
    or v_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or v_provider_payment_id is null
    or v_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' then
    raise exception using errcode = '22023', message = 'Payment identifiers are invalid.';
  end if;

  select payment.* into v_payment
  from public.payments as payment
  join public.orders as owned_order on owned_order.id = payment.order_id
  where payment.id = p_payment_id and owned_order.user_id = v_user_id
  for update of payment;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment is unavailable.';
  end if;

  select owned_order.* into v_order
  from public.orders as owned_order
  where owned_order.id = v_payment.order_id and owned_order.user_id = v_user_id
  for update;

  if not found
    or v_payment.provider is distinct from 'razorpay'
    or v_payment.provider_order_id is distinct from v_provider_order_id then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  -- Authenticated/HMAC-only callers can never cross the commercial deadline.
  -- Retire and return no confirmation; the server route may recover only after
  -- it has independently fetched and validated canonical captured evidence.
  if v_payment.status = 'pending' and v_order.status = 'pending'
    and v_order.payment_status = 'pending'
    and v_order.checkout_expires_at <= pg_catalog.now() then
    update public.payments set status = 'failed' where id = v_payment.id;
    update public.orders set status = 'cancelled', payment_status = 'failed',
      checkout_expired_at = pg_catalog.now() where id = v_order.id;
    return;
  end if;
  if v_payment.amount is null
    or v_payment.amount <= 0
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.currency::text is distinct from v_order.currency::text
    or v_order.subtotal is null
    or v_order.subtotal <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  if (select pg_catalog.count(*) from public.order_items as counted
      where counted.order_id = v_order.id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  select item.* into v_item
  from public.order_items as item
  join public.evo_vault_products as product on product.id = item.vault_product_id
  join public.evo_vault_books as book on book.vault_product_id = product.id
  where item.order_id = v_order.id
    and item.source = 'evo_vault'
    and item.quantity = 1
    and item.vault_product_id is not null
    and item.store_variant_id is null
    and item.discount_amount = 0
    and item.unit_price = v_order.subtotal
    and item.total_price = v_order.total_amount
    and product.kind = 'book'
    and product.product_mode = 'digital';

  if not found then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  end if;

  if v_payment.provider_payment_id is not distinct from v_provider_payment_id
    and v_payment.status is not distinct from 'paid'
    and v_payment.paid_at is not null
    and v_order.payment_status is not distinct from 'paid'
    and v_order.status is not distinct from 'confirmed'
    and v_order.confirmed_at is not null then
    -- Valid duplicate confirmation: fall through so fulfillment is recovered too.
  elsif v_payment.provider_payment_id is not null
    or v_payment.status is distinct from 'pending'
    or v_order.payment_status is distinct from 'pending'
    or v_order.status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Payment requires reconciliation.';
  else
    v_now := pg_catalog.now();

    update public.payments
    set provider_payment_id = v_provider_payment_id,
        status = 'paid',
        paid_at = v_now
    where id = v_payment.id
    returning * into v_payment;

    update public.orders
    set payment_status = 'paid',
        status = 'confirmed',
        confirmed_at = v_now
    where id = v_order.id
    returning * into v_order;
  end if;

  -- The nested function executes inside this transaction. Any fulfillment error
  -- rolls confirmation back, preventing a paid/confirmed row without ownership.
  perform public.fulfill_confirmed_evo_vault_order(v_order.id);

  return query select v_payment.id, v_order.id, v_payment.provider_order_id,
    v_payment.provider_payment_id, v_payment.status, v_order.status;
end;
$$;

revoke all on function public.confirm_razorpay_payment(uuid, text, text) from public;
revoke all on function public.confirm_razorpay_payment(uuid, text, text) from anon;
grant execute on function public.confirm_razorpay_payment(uuid, text, text) to authenticated;

comment on function public.confirm_razorpay_payment(uuid, text, text) is
  'Atomically confirms an owned Razorpay payment after server-side Checkout signature verification and grants idempotent Vault ownership.';
