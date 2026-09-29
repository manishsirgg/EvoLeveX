-- Stage 3C: durable Razorpay webhook receipt and atomic captured-payment reconciliation.
-- This migration does not backfill or otherwise mutate historical commerce rows.

alter table public.payment_webhook_events
  add column processing_status text not null default 'received',
  add column provider_order_id text,
  add column provider_payment_id text,
  add column payment_id uuid references public.payments(id),
  add column order_id uuid references public.orders(id),
  add column attempt_count integer not null default 0,
  add column last_attempted_at timestamptz,
  add column payload_sha256 text,
  add column safe_error_code text,
  add constraint payment_webhook_events_processing_status_check
    check (processing_status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  add constraint payment_webhook_events_attempt_count_check check (attempt_count >= 0),
  add constraint payment_webhook_events_payload_sha256_check
    check (payload_sha256 is null or payload_sha256 ~ '^[a-f0-9]{64}$'),
  add constraint payment_webhook_events_provider_order_id_check
    check (provider_order_id is null or provider_order_id ~ '^order_[A-Za-z0-9]{8,64}$'),
  add constraint payment_webhook_events_provider_payment_id_check
    check (provider_payment_id is null or provider_payment_id ~ '^pay_[A-Za-z0-9]{8,64}$'),
  add constraint payment_webhook_events_safe_error_code_check
    check (safe_error_code is null or safe_error_code ~ '^[a-z][a-z0-9_]{0,63}$');

drop index public.payment_webhook_events_unprocessed_received_at_idx;
create index payment_webhook_events_retryable_received_at_idx
  on public.payment_webhook_events (received_at)
  where processing_status in ('received', 'processing', 'failed') and processed_at is null;

create function public.begin_razorpay_webhook_event(
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_payload_sha256 text,
  p_provider_order_id text,
  p_provider_payment_id text
)
returns table (
  processing_status text,
  payment_id uuid,
  order_id uuid,
  amount numeric,
  currency text,
  provider_order_id text,
  provider_payment_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_provider_event_id is null or p_provider_event_id !~ '^[!-~]{1,255}$'
    or p_event_type not in ('payment.captured', 'order.paid')
    or p_payload is null
    or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or p_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]{8,64}$' then
    raise exception using errcode = '22023', message = 'Webhook receipt is invalid.';
  end if;

  insert into public.payment_webhook_events (
    provider, provider_event_id, event_type, payload, payload_sha256,
    provider_order_id, provider_payment_id
  ) values (
    'razorpay', p_provider_event_id, p_event_type, p_payload, p_payload_sha256,
    p_provider_order_id, p_provider_payment_id
  ) on conflict (provider, provider_event_id) do nothing;

  select event.* into v_event
  from public.payment_webhook_events as event
  where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id
  for update;

  if v_event.event_type is distinct from p_event_type
    or v_event.payload_sha256 is distinct from p_payload_sha256
    or v_event.provider_order_id is distinct from p_provider_order_id
    or v_event.provider_payment_id is distinct from p_provider_payment_id then
    raise exception using errcode = '22023', message = 'Webhook event identity conflicts.';
  end if;

  if v_event.processing_status in ('processed', 'ignored') then
    return query select v_event.processing_status, v_event.payment_id, v_event.order_id,
      payment.amount, payment.currency::text, v_event.provider_order_id, v_event.provider_payment_id
    from public.payments as payment where payment.id = v_event.payment_id;
    if not found then
      return query select v_event.processing_status, null::uuid, null::uuid, null::numeric,
        null::text, v_event.provider_order_id, v_event.provider_payment_id;
    end if;
    return;
  end if;

  select payment.* into v_payment
  from public.payments as payment
  where payment.provider = 'razorpay' and payment.provider_order_id = p_provider_order_id;
  if not found then
    update public.payment_webhook_events
    set processing_status = 'processing', attempt_count = attempt_count + 1,
        last_attempted_at = pg_catalog.now(), processing_error = null, safe_error_code = null
    where id = v_event.id returning * into v_event;
    return query select v_event.processing_status, null::uuid, null::uuid, null::numeric,
      null::text, v_event.provider_order_id, v_event.provider_payment_id;
    return;
  end if;

  update public.payment_webhook_events
  set processing_status = 'processing', attempt_count = attempt_count + 1,
      last_attempted_at = pg_catalog.now(), processing_error = null, safe_error_code = null,
      payment_id = v_payment.id, order_id = v_payment.order_id
  where id = v_event.id
  returning * into v_event;

  return query select v_event.processing_status, v_payment.id, v_payment.order_id,
    v_payment.amount, v_payment.currency::text, v_payment.provider_order_id,
    v_event.provider_payment_id;
end;
$$;

create function public.ignore_razorpay_webhook_event(
  p_provider_event_id text, p_event_type text, p_payload jsonb, p_payload_sha256 text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_event public.payment_webhook_events%rowtype;
begin
  if p_provider_event_id is null or p_provider_event_id !~ '^[!-~]{1,255}$'
    or p_event_type is null or pg_catalog.btrim(p_event_type) = ''
    or p_payload is null or p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Webhook receipt is invalid.';
  end if;
  insert into public.payment_webhook_events (
    provider, provider_event_id, event_type, payload, payload_sha256,
    processing_status, attempt_count, last_attempted_at, processed_at
  ) values (
    'razorpay', p_provider_event_id, p_event_type, p_payload, p_payload_sha256,
    'ignored', 1, pg_catalog.now(), pg_catalog.now()
  ) on conflict (provider, provider_event_id) do nothing;
  select event.* into v_event from public.payment_webhook_events event
    where event.provider = 'razorpay' and event.provider_event_id = p_provider_event_id for update;
  if v_event.event_type is distinct from p_event_type
    or v_event.payload_sha256 is distinct from p_payload_sha256 then
    raise exception using errcode = '22023', message = 'Webhook event identity conflicts.';
  end if;
  if v_event.processing_status not in ('processed', 'ignored') then
    update public.payment_webhook_events set processing_status = 'ignored',
      attempt_count = attempt_count + 1, last_attempted_at = pg_catalog.now(),
      processed_at = pg_catalog.now(), processing_error = null, safe_error_code = null
    where id = v_event.id;
  end if;
  return 'ignored';
end;
$$;

create function public.fail_razorpay_webhook_event(
  p_provider_event_id text, p_payload_sha256 text, p_safe_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_safe_error_code !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception using errcode = '22023', message = 'Safe error code is invalid.';
  end if;
  update public.payment_webhook_events
  set processing_status = 'failed', processed_at = null,
      processing_error = p_safe_error_code, safe_error_code = p_safe_error_code
  where provider = 'razorpay' and provider_event_id = p_provider_event_id
    and payload_sha256 = p_payload_sha256 and processing_status not in ('processed', 'ignored');
end;
$$;

create function public.reconcile_captured_razorpay_payment(
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
  elsif v_payment.provider_payment_id is not null or v_payment.status <> 'pending'
    or v_order.payment_status <> 'pending' or v_order.status <> 'pending' then
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
