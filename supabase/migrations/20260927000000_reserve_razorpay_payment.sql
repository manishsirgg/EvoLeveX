-- Abort rather than guessing how to reconcile pre-existing duplicate provider relationships.
lock table public.payments in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.payments
    group by order_id, provider
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'Cannot add payments order/provider uniqueness: duplicate relationships exist.';
  end if;
end;
$$;

alter table public.payments
  add constraint payments_order_id_provider_key unique (order_id, provider);

create function public.reserve_razorpay_payment(p_order_id uuid)
returns table (
  payment_id uuid,
  order_id uuid,
  amount numeric,
  currency text,
  provider_order_id text,
  created boolean
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

  -- This transaction lock serializes local reservation only. It ends before any provider HTTP call.
  perform pg_catalog.pg_advisory_xact_lock(
    (('x' || pg_catalog.substr(pg_catalog.md5(p_order_id::text), 1, 16))::bit(64)::bigint)
  );

  select candidate.* into v_order
  from public.orders as candidate
  where candidate.id = p_order_id and candidate.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Order is unavailable.';
  end if;
  if v_order.status is distinct from 'pending' or v_order.payment_status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Order is not pending.';
  end if;
  if v_order.subtotal is null
    or v_order.total_amount is null
    or v_order.subtotal <= 0
    or v_order.total_amount <= 0
    or v_order.subtotal is distinct from v_order.total_amount
    or v_order.discount_amount is distinct from 0::numeric
    or v_order.shipping_amount is distinct from 0::numeric
    or v_order.tax_amount is distinct from 0::numeric then
    raise exception using errcode = 'P0001', message = 'Order totals are invalid.';
  end if;

  if (select pg_catalog.count(*) from public.order_items as counted where counted.order_id = p_order_id) <> 1 then
    raise exception using errcode = 'P0001', message = 'Order items are invalid.';
  end if;

  select item.* into v_item
  from public.order_items as item
  where item.order_id = p_order_id;

  if v_item.source is distinct from 'evo_vault'
    or v_item.quantity is distinct from 1
    or v_item.vault_product_id is null
    or v_item.store_variant_id is not null
    or v_item.discount_amount is distinct from 0::numeric
    or v_item.unit_price is distinct from v_order.subtotal
    or v_item.total_price is distinct from v_order.total_amount then
    raise exception using errcode = 'P0001', message = 'Order item is invalid.';
  end if;

  select product.* into v_product
  from public.evo_vault_products as product
  where product.id = v_item.vault_product_id;

  if not found
    or v_product.is_active is not true
    or v_product.kind is distinct from 'book'
    or v_product.product_mode is distinct from 'digital'
    or v_product.price is null
    or v_product.price <= 0
    or v_product.price is distinct from v_item.unit_price
    or v_product.currency::text is distinct from v_order.currency::text then
    raise exception using errcode = 'P0001', message = 'Product is unavailable.';
  end if;

  if not exists (
    select 1 from public.evo_vault_books as book
    where book.vault_product_id = v_item.vault_product_id
      and book.digital_file_path is not null
      and pg_catalog.btrim(book.digital_file_path) <> ''
      and book.digital_file_size is not null
      and book.digital_file_size > 0
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

  select payment.* into v_payment
  from public.payments as payment
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
    p_order_id, 'razorpay', null, null, v_order.total_amount, v_order.currency, 'pending',
    pg_catalog.jsonb_build_object('local_order_id', p_order_id)
  ) returning * into v_payment;

  return query select v_payment.id, v_payment.order_id, v_payment.amount,
    v_payment.currency::text, v_payment.provider_order_id, true;
end;
$$;

revoke all on function public.reserve_razorpay_payment(uuid) from public;
revoke all on function public.reserve_razorpay_payment(uuid) from anon;
grant execute on function public.reserve_razorpay_payment(uuid) to authenticated;

comment on function public.reserve_razorpay_payment(uuid) is
  'Validates a customer digital-book order and reserves its single pending Razorpay payment relationship.';

create function public.attach_razorpay_order(p_payment_id uuid, p_provider_order_id text)
returns table (
  payment_id uuid,
  order_id uuid,
  amount numeric,
  currency text,
  provider_order_id text
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
  if v_payment.provider is distinct from 'razorpay' or v_payment.status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Payment is not eligible.';
  end if;

  select owned_order.* into v_order
  from public.orders as owned_order
  where owned_order.id = v_payment.order_id and owned_order.user_id = v_user_id;

  if v_order.status is distinct from 'pending' or v_order.payment_status is distinct from 'pending' then
    raise exception using errcode = 'P0001', message = 'Order is not pending.';
  end if;

  if v_payment.provider_order_id is null then
    update public.payments
    set provider_order_id = v_provider_order_id
    where id = v_payment.id
    returning * into v_payment;
  elsif v_payment.provider_order_id is distinct from v_provider_order_id then
    raise exception using errcode = 'P0001', message = 'Provider order reconciliation conflict.';
  end if;

  return query select v_payment.id, v_payment.order_id, v_payment.amount,
    v_payment.currency::text, v_payment.provider_order_id;
end;
$$;

revoke all on function public.attach_razorpay_order(uuid, text) from public;
revoke all on function public.attach_razorpay_order(uuid, text) from anon;
grant execute on function public.attach_razorpay_order(uuid, text) to authenticated;

comment on function public.attach_razorpay_order(uuid, text) is
  'Idempotently attaches a Razorpay order ID to an owned pending payment without changing payment or order status.';
