create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_webhook_events_provider_event_key unique (provider, provider_event_id),
  constraint payment_webhook_events_provider_event_id_check check (btrim(provider_event_id) <> ''),
  constraint payment_webhook_events_event_type_check check (btrim(event_type) <> '')
);

create index payment_webhook_events_unprocessed_received_at_idx
  on public.payment_webhook_events (received_at)
  where processed_at is null;

create trigger set_payment_webhook_events_updated_at
before update on public.payment_webhook_events
for each row execute function public.set_updated_at();

alter table public.payment_webhook_events enable row level security;

revoke all on table public.payment_webhook_events from anon, authenticated;
grant select on table public.payment_webhook_events to authenticated;

create policy "Staff can inspect payment webhook events"
on public.payment_webhook_events for select
to authenticated
using (private.is_staff());

comment on table public.payment_webhook_events is
  'Durable payment-provider webhook event ledger.';
comment on constraint payment_webhook_events_provider_event_key on public.payment_webhook_events is
  'Provider and provider event ID uniqueness provides webhook replay and idempotency protection.';
comment on column public.payment_webhook_events.payload is
  'Preserves the received provider event for reconciliation and debugging.';
