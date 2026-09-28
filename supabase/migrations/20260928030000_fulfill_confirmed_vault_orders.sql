-- Phase 4A: grant canonical Vault ownership in the same transaction that confirms
-- a cryptographically verified Razorpay payment. No historical rows are backfilled.

create function public.fulfill_confirmed_evo_vault_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_existing public.digital_access%rowtype;
  v_access_id uuid;
begin
  if p_order_id is null then
    raise exception using errcode = '22023', message = 'An order is required.';
  end if;

  select candidate.* into v_order
  from public.orders as candidate
  where candidate.id = p_order_id
  for update;

  if not found
    or v_order.status is distinct from 'confirmed'
    or v_order.payment_status is distinct from 'paid'
    or v_order.confirmed_at is null then
    raise exception using errcode = 'P0001', message = 'Order is not eligible for Vault fulfillment.';
  end if;

  -- The paid provider relationship, not a caller assertion, authorizes fulfillment.
  if not exists (
    select 1
    from public.payments as payment
    where payment.order_id = v_order.id
      and payment.provider = 'razorpay'
      and payment.status = 'paid'
      and payment.provider_order_id is not null
      and payment.provider_payment_id is not null
      and payment.paid_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'Order payment is not eligible for Vault fulfillment.';
  end if;

  if (select pg_catalog.count(*) from public.order_items as counted
      where counted.order_id = v_order.id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Order items are not eligible for Vault fulfillment.';
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
    and product.kind = 'book'
    and product.product_mode = 'digital';

  if not found then
    raise exception using errcode = 'P0001', message = 'Order item is not eligible for Vault fulfillment.';
  end if;

  insert into public.digital_access (
    user_id, source, vault_product_id, store_variant_id, order_item_id,
    status, granted_at, expires_at, revoked_at
  ) values (
    v_order.user_id, 'evo_vault', v_item.vault_product_id, null, v_item.id,
    'active', pg_catalog.now(), null, null
  )
  on conflict (user_id, vault_product_id) where vault_product_id is not null
  do update set
    status = 'active',
    expires_at = null,
    revoked_at = null,
    updated_at = pg_catalog.now()
  -- A retry must not undo a later revocation of the entitlement it originally made.
  -- A genuinely new purchase may reactivate an older expired/revoked entitlement,
  -- while retaining its original provenance and grant timestamp.
  where public.digital_access.status is distinct from 'active'
    and public.digital_access.order_item_id is distinct from excluded.order_item_id
  returning id into v_access_id;

  if v_access_id is null then
    select access.* into v_existing
    from public.digital_access as access
    where access.user_id = v_order.user_id
      and access.vault_product_id = v_item.vault_product_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'Vault fulfillment requires reconciliation.';
    end if;
    v_access_id := v_existing.id;
  end if;

  return v_access_id;
end;
$$;

revoke all on function public.fulfill_confirmed_evo_vault_order(uuid) from public;
revoke all on function public.fulfill_confirmed_evo_vault_order(uuid) from anon;
revoke all on function public.fulfill_confirmed_evo_vault_order(uuid) from authenticated;
grant execute on function public.fulfill_confirmed_evo_vault_order(uuid) to service_role;

comment on function public.fulfill_confirmed_evo_vault_order(uuid) is
  'Idempotently grants canonical digital_access for one confirmed, paid Razorpay Vault order; callable directly only by service_role for controlled recovery.';

-- Defense in depth: customers retain any existing SELECT path protected by RLS,
-- but browser roles cannot mutate canonical entitlements even if a write policy is
-- accidentally introduced later.
revoke insert, update, delete on table public.digital_access from anon;
revoke insert, update, delete on table public.digital_access from authenticated;

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
