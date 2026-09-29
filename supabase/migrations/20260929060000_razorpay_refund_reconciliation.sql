-- Stage 3D: exceptional provider-refund reconciliation for final-sale Vault downloads.
-- No refund initiation or customer return workflow is introduced by this migration.

alter table public.payments
  add column refunded_amount numeric not null default 0,
  add constraint payments_refunded_amount_nonnegative_check check (refunded_amount >= 0),
  add constraint payments_refunded_amount_not_overpaid_check check (refunded_amount <= amount);

alter table public.payment_webhook_events
  add column provider_refund_id text,
  add constraint payment_webhook_events_provider_refund_id_check
    check (provider_refund_id is null or provider_refund_id ~ '^rfnd_[A-Za-z0-9]{8,64}$');

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  provider public.payment_provider not null,
  provider_refund_id text not null,
  amount numeric not null,
  currency text not null,
  status text not null,
  provider_created_at timestamptz,
  processed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_refunds_provider_refund_key unique (provider, provider_refund_id),
  constraint payment_refunds_provider_refund_id_check check (provider_refund_id ~ '^rfnd_[A-Za-z0-9]{8,64}$'),
  constraint payment_refunds_amount_positive_check check (amount > 0),
  constraint payment_refunds_currency_check check (currency in ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')),
  constraint payment_refunds_status_check check (status in ('processed'))
);

create index payment_refunds_payment_id_idx on public.payment_refunds (payment_id);
create trigger set_payment_refunds_updated_at before update on public.payment_refunds
for each row execute function public.set_updated_at();
alter table public.payment_refunds enable row level security;
revoke all on table public.payment_refunds from anon, authenticated;
grant select on table public.payment_refunds to authenticated;
create policy "Staff can inspect payment refunds" on public.payment_refunds for select
to authenticated using ((select private.is_staff()));

comment on table public.payment_refunds is
  'Normalized immutable-identity ledger of successful provider refunds; not a refund initiation surface.';
comment on column public.payment_webhook_events.provider_refund_id is
  'Operational correlation only; provider and provider_refund_id on payment_refunds are business idempotency authority.';

-- Correct entitlement provenance on a genuine repurchase while retaining the
-- same-order retry guard in the conflict WHERE clause.
create or replace function public.fulfill_confirmed_evo_vault_order(p_order_id uuid)
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
    order_item_id = excluded.order_item_id,
    status = 'active',
    granted_at = excluded.granted_at,
    expires_at = null,
    revoked_at = null,
    updated_at = pg_catalog.now()
  -- A retry must not undo a later revocation of the entitlement it originally made.
  -- A genuinely new purchase may reactivate an older expired/revoked entitlement,
  -- and replaces provenance and grant time with the new paid order item.
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


revoke all on function public.fulfill_confirmed_evo_vault_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_confirmed_evo_vault_order(uuid) to service_role;

create function public.begin_razorpay_refund_webhook_event(
  p_provider_event_id text, p_payload jsonb, p_payload_sha256 text,
  p_provider_payment_id text, p_provider_refund_id text
)
returns table (processing_status text, payment_id uuid, order_id uuid, amount numeric,
  refunded_amount numeric, currency text, provider_payment_id text, provider_refund_id text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_provider_event_id is null or p_provider_event_id !~ '^[!-~]{1,255}$'
    or p_payload is null or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$'
    or p_provider_refund_id !~ '^rfnd_[A-Za-z0-9]{8,64}$' then
    raise exception using errcode = '22023', message = 'Refund webhook receipt is invalid.';
  end if;

  insert into public.payment_webhook_events (provider, provider_event_id, event_type, payload,
    payload_sha256, provider_payment_id, provider_refund_id)
  values ('razorpay', p_provider_event_id, 'refund.processed', p_payload, p_payload_sha256,
    p_provider_payment_id, p_provider_refund_id)
  on conflict (provider, provider_event_id) do nothing;

  select event.* into v_event from public.payment_webhook_events event
  where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id for update;
  if v_event.event_type is distinct from 'refund.processed'
    or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_payment_id is distinct from p_provider_payment_id
    or v_event.provider_refund_id is distinct from p_provider_refund_id then
    raise exception using errcode = '22023', message = 'Refund webhook event identity conflicts.';
  end if;

  select payment.* into v_payment from public.payments payment
  where payment.provider = 'razorpay' and payment.provider_payment_id = p_provider_payment_id;

  -- Match the Stage 3C receipt contract: retain the signed event for bounded
  -- failure/retry handling, but never manufacture payment/order values when the
  -- provider payment is not known locally.
  if not found then
    if v_event.processing_status not in ('processed', 'ignored') then
      update public.payment_webhook_events set processing_status = 'processing',
        attempt_count = attempt_count + 1, last_attempted_at = pg_catalog.now(),
        processing_error = null, safe_error_code = null, payment_id = null,
        order_id = null
      where id = v_event.id returning * into v_event;
    end if;

    return query select v_event.processing_status, null::uuid, null::uuid,
      null::numeric, null::numeric, null::text, v_event.provider_payment_id,
      v_event.provider_refund_id;
    return;
  end if;

  if v_event.processing_status not in ('processed', 'ignored') then
    update public.payment_webhook_events set processing_status = 'processing',
      attempt_count = attempt_count + 1, last_attempted_at = pg_catalog.now(),
      processing_error = null, safe_error_code = null, payment_id = v_payment.id,
      order_id = v_payment.order_id
    where id = v_event.id returning * into v_event;
  end if;

  return query select v_event.processing_status, v_payment.id, v_payment.order_id,
    v_payment.amount, v_payment.refunded_amount, v_payment.currency::text,
    v_event.provider_payment_id, v_event.provider_refund_id;
end;
$$;

create function public.reconcile_processed_razorpay_refund(
  p_provider_event_id text, p_payload_sha256 text, p_provider_refund_id text,
  p_provider_payment_id text, p_refund_amount bigint, p_provider_currency text,
  p_provider_created_at timestamptz
)
returns table (payment_id uuid, order_id uuid, refunded_amount numeric, processing_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_existing public.payment_refunds%rowtype;
  v_refund_amount numeric;
  v_cumulative numeric;
  v_now timestamptz := pg_catalog.now();
begin
  if p_provider_event_id is null or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_refund_id !~ '^rfnd_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' or p_refund_amount <= 0
    or p_provider_currency not in ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')
    or p_provider_created_at is null then
    raise exception using errcode = '22023', message = 'Refund reconciliation input is invalid.';
  end if;

  select event.* into v_event from public.payment_webhook_events event
  where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id for update;
  if not found or v_event.event_type is distinct from 'refund.processed'
    or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_refund_id is distinct from p_provider_refund_id
    or v_event.provider_payment_id is distinct from p_provider_payment_id then
    raise exception using errcode = 'P0001', message = 'Refund webhook requires reconciliation.';
  end if;
  if v_event.processing_status = 'processed' then
    return query select v_event.payment_id, v_event.order_id, payment.refunded_amount, 'processed'::text
      from public.payments payment where payment.id = v_event.payment_id;
    return;
  end if;
  if v_event.processing_status <> 'processing' then
    raise exception using errcode = 'P0001', message = 'Refund webhook is not claimed.';
  end if;

  select payment.* into v_payment from public.payments payment
  where payment.provider = 'razorpay' and payment.provider_payment_id = p_provider_payment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Payment is unavailable.'; end if;
  select candidate.* into v_order from public.orders candidate where candidate.id = v_payment.order_id for update;

  if p_provider_currency = 'JPY' then
    v_refund_amount := p_refund_amount::numeric;
  else
    v_refund_amount := p_refund_amount::numeric / 100;
  end if;
  if v_payment.currency::text is distinct from p_provider_currency
    or v_order.currency::text is distinct from p_provider_currency
    or v_payment.amount is distinct from v_order.total_amount
    or v_payment.status not in ('paid', 'partially_refunded', 'refunded')
    or v_order.status not in ('confirmed', 'refunded') then
    raise exception using errcode = 'P0001', message = 'Refund payment requires reconciliation.';
  end if;

  select refund.* into v_existing from public.payment_refunds refund
  where refund.provider = 'razorpay' and refund.provider_refund_id = p_provider_refund_id for update;
  if found and (v_existing.payment_id is distinct from v_payment.id
    or v_existing.amount is distinct from v_refund_amount
    or v_existing.currency is distinct from p_provider_currency
    or v_existing.status is distinct from 'processed') then
    raise exception using errcode = 'P0001', message = 'Provider refund identity conflicts.';
  end if;

  insert into public.payment_refunds (payment_id, provider, provider_refund_id, amount, currency,
    status, provider_created_at, processed_at)
  values (v_payment.id, 'razorpay', p_provider_refund_id, v_refund_amount, p_provider_currency,
    'processed', p_provider_created_at, v_now)
  on conflict (provider, provider_refund_id) do nothing;

  select pg_catalog.coalesce(pg_catalog.sum(refund.amount), 0) into v_cumulative
  from public.payment_refunds refund where refund.payment_id = v_payment.id and refund.status = 'processed';
  if v_cumulative > v_payment.amount then
    raise exception using errcode = 'P0001', message = 'Cumulative refund exceeds payment.';
  end if;

  if v_cumulative < v_payment.amount then
    if v_order.status is distinct from 'confirmed' then
      raise exception using errcode = 'P0001', message = 'Partial refund order requires reconciliation.';
    end if;
    update public.payments set refunded_amount = v_cumulative, status = 'partially_refunded'
      where id = v_payment.id;
    update public.orders set payment_status = 'partially_refunded' where id = v_order.id;
  else
    update public.payments set refunded_amount = v_cumulative, status = 'refunded',
      refunded_at = pg_catalog.coalesce(refunded_at, p_provider_created_at, v_now) where id = v_payment.id;
    update public.orders set payment_status = 'refunded', status = 'refunded',
      refunded_at = pg_catalog.coalesce(refunded_at, p_provider_created_at, v_now) where id = v_order.id;
    update public.digital_access access set status = 'revoked', revoked_at = v_now, updated_at = v_now
    from public.order_items item
    where item.order_id = v_order.id and item.source = 'evo_vault'
      and item.vault_product_id is not null and item.store_variant_id is null
      and access.order_item_id = item.id and access.user_id = v_order.user_id
      and access.source = 'evo_vault' and access.vault_product_id = item.vault_product_id
      and access.status = 'active' and access.revoked_at is null;
  end if;

  update public.payment_webhook_events set processing_status = 'processed', processed_at = v_now,
    processing_error = null, safe_error_code = null, payment_id = v_payment.id, order_id = v_order.id
  where id = v_event.id;
  return query select v_payment.id, v_order.id, v_cumulative, 'processed'::text;
end;
$$;

revoke all on function public.begin_razorpay_refund_webhook_event(text,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.reconcile_processed_razorpay_refund(text,text,text,text,bigint,text,timestamptz) from public, anon, authenticated;
grant execute on function public.begin_razorpay_refund_webhook_event(text,jsonb,text,text,text) to service_role;
grant execute on function public.reconcile_processed_razorpay_refund(text,text,text,text,bigint,text,timestamptz) to service_role;

comment on function public.reconcile_processed_razorpay_refund(text,text,text,text,bigint,text,timestamptz) is
  'Service-only atomic reconciliation of a canonically verified processed Razorpay refund.';
