-- Repair Stage 3D refund reconciliation without changing its contract or privilege boundary.
-- COALESCE is PostgreSQL conditional-expression syntax, not a pg_catalog function.

create or replace function public.reconcile_processed_razorpay_refund(
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

  select coalesce(pg_catalog.sum(refund.amount), 0::numeric) into v_cumulative
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
      refunded_at = coalesce(refunded_at, p_provider_created_at, v_now) where id = v_payment.id;
    update public.orders set payment_status = 'refunded', status = 'refunded',
      refunded_at = coalesce(refunded_at, p_provider_created_at, v_now) where id = v_order.id;
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


-- CREATE OR REPLACE preserves existing function privileges. Reassert the intended
-- execution boundary explicitly so future privilege drift cannot broaden this RPC.
revoke all on function public.reconcile_processed_razorpay_refund(text,text,text,text,bigint,text,timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_processed_razorpay_refund(text,text,text,text,bigint,text,timestamptz) to service_role;
