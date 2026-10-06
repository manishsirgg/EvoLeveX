-- Evo Store V1 Stage 1B Phase 2J-A: schema only; no inventory effects or RPCs.

-- One live whitelist shared with authoritative Store variant prices.
create function private.evo_store_currency_supported(p_currency text)
returns boolean
language sql immutable strict security invoker
set search_path = ''
as $$
  select p_currency in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY');
$$;
revoke all on function private.evo_store_currency_supported(text) from public, anon, authenticated;
grant execute on function private.evo_store_currency_supported(text) to authenticated, service_role;

-- Same accepted values and constraint name; no catalog data changes.
alter table public.evo_store_variant_prices
  drop constraint evo_store_variant_prices_currency_supported_check,
  add constraint evo_store_variant_prices_currency_supported_check
    check (private.evo_store_currency_supported(currency::text));

create type public.evo_store_checkout_status as enum ('active', 'released', 'expired', 'consumed');

create table public.evo_store_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  status public.evo_store_checkout_status not null default 'active',
  currency char(3) not null,
  subtotal numeric(14,2) not null,
  discount_total numeric(14,2) not null default 0,
  shipping_total numeric(14,2),
  tax_total numeric(14,2),
  grand_total numeric(14,2),
  address_id uuid references public.addresses(id) on delete set null,
  shipping_full_name text not null,
  shipping_phone text not null,
  shipping_address_line1 text not null,
  shipping_address_line2 text,
  shipping_landmark text,
  shipping_city text not null,
  shipping_state text not null,
  shipping_postal_code text not null,
  shipping_country text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  expired_at timestamptz,
  consumed_at timestamptz,
  constraint evo_store_checkouts_currency_supported_check
    check (private.evo_store_currency_supported(currency::text)),
  constraint evo_store_checkouts_amount_check check (
    subtotal > 0 and subtotal <> 'NaN'::numeric
    and discount_total >= 0 and discount_total <> 'NaN'::numeric
    and (shipping_total is null or (shipping_total >= 0 and shipping_total <> 'NaN'::numeric))
    and (tax_total is null or (tax_total >= 0 and tax_total <> 'NaN'::numeric))
    and (grand_total is null or (grand_total >= 0 and grand_total <> 'NaN'::numeric))
  ),
  constraint evo_store_checkouts_jpy_integral_check check (
    currency <> 'JPY' or (
      subtotal = trunc(subtotal) and discount_total = trunc(discount_total)
      and (shipping_total is null or shipping_total = trunc(shipping_total))
      and (tax_total is null or tax_total = trunc(tax_total))
      and (grand_total is null or grand_total = trunc(grand_total))
    )
  ),
  constraint evo_store_checkouts_expiry_check check (expires_at > created_at),
  constraint evo_store_checkouts_fingerprint_check check (request_fingerprint ~ '[^[:space:]]'),
  constraint evo_store_checkouts_shipping_snapshot_check check (
    shipping_full_name ~ '[^[:space:]]' and shipping_phone ~ '[^[:space:]]'
    and shipping_address_line1 ~ '[^[:space:]]' and shipping_city ~ '[^[:space:]]'
    and shipping_state ~ '[^[:space:]]' and shipping_postal_code ~ '[^[:space:]]'
    and shipping_country ~ '[^[:space:]]'
  ),
  constraint evo_store_checkouts_lifecycle_check check (
    (status = 'active' and released_at is null and expired_at is null and consumed_at is null)
    or (status = 'released' and released_at is not null and expired_at is null and consumed_at is null)
    or (status = 'expired' and expired_at is not null and released_at is null and consumed_at is null)
    or (status = 'consumed' and consumed_at is not null and released_at is null and expired_at is null)
  ),
  constraint evo_store_checkouts_user_idempotency_key unique (user_id, idempotency_key),
  -- Required referenced key for declarative cross-table currency equality.
  constraint evo_store_checkouts_id_currency_key unique (id, currency)
);

create unique index evo_store_checkouts_one_active_user_idx
  on public.evo_store_checkouts (user_id) where status = 'active';
create index evo_store_checkouts_active_expiry_idx
  on public.evo_store_checkouts (expires_at, id) where status = 'active';
create index evo_store_checkouts_user_history_idx
  on public.evo_store_checkouts (user_id, created_at desc, id desc);

create table public.evo_store_checkout_items (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null,
  variant_id uuid not null references public.evo_store_variants(id) on delete restrict,
  product_id uuid not null references public.evo_store_products(id) on delete restrict,
  quantity integer not null,
  currency char(3) not null,
  unit_price numeric(14,2) not null,
  line_subtotal numeric(14,2) not null,
  product_name text not null,
  variant_name text,
  sku text not null,
  size_code text,
  color_code text,
  constraint evo_store_checkout_items_checkout_currency_fkey
    foreign key (checkout_id, currency) references public.evo_store_checkouts(id, currency)
    on delete restrict on update restrict,
  constraint evo_store_checkout_items_quantity_check check (quantity between 1 and 10),
  constraint evo_store_checkout_items_amount_check check (
    unit_price > 0 and unit_price <> 'NaN'::numeric
    and line_subtotal > 0 and line_subtotal <> 'NaN'::numeric
    and line_subtotal = quantity * unit_price
  ),
  constraint evo_store_checkout_items_currency_supported_check
    check (private.evo_store_currency_supported(currency::text)),
  constraint evo_store_checkout_items_jpy_integral_check check (
    currency <> 'JPY' or (unit_price = trunc(unit_price) and line_subtotal = trunc(line_subtotal))
  ),
  constraint evo_store_checkout_items_snapshot_check
    check (product_name ~ '[^[:space:]]' and sku ~ '[^[:space:]]'),
  constraint evo_store_checkout_items_checkout_variant_key unique (checkout_id, variant_id)
);
create index evo_store_checkout_items_checkout_order_idx
  on public.evo_store_checkout_items (checkout_id, id);
create index evo_store_checkout_items_variant_checkout_idx
  on public.evo_store_checkout_items (variant_id, checkout_id);

-- Row checks validate a state; this narrow guard validates terminal transitions.
create function private.guard_evo_store_checkout_terminal_status()
returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  if old.status <> 'active'::public.evo_store_checkout_status
     and new.status is distinct from old.status then
    raise exception using errcode = '23514', message = 'EVO_STORE_CHECKOUT_TERMINAL_STATUS';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_evo_store_checkout_terminal_status() from public, anon, authenticated;
create trigger evo_store_checkouts_terminal_status
before update of status on public.evo_store_checkouts
for each row execute function private.guard_evo_store_checkout_terminal_status();
create trigger evo_store_checkouts_updated_at
before update on public.evo_store_checkouts
for each row execute function public.set_updated_at();

alter table public.evo_store_checkouts enable row level security;
alter table public.evo_store_checkout_items enable row level security;
create policy evo_store_checkouts_owner_read on public.evo_store_checkouts
for select to authenticated using (user_id = (select auth.uid()));
create policy evo_store_checkouts_staff_read on public.evo_store_checkouts
for select to authenticated using ((select private.is_staff()));
create policy evo_store_checkout_items_owner_read on public.evo_store_checkout_items
for select to authenticated using (exists (
  select 1 from public.evo_store_checkouts checkout
  where checkout.id = evo_store_checkout_items.checkout_id
    and checkout.user_id = (select auth.uid())
));
create policy evo_store_checkout_items_staff_read on public.evo_store_checkout_items
for select to authenticated using ((select private.is_staff()));
revoke all on table public.evo_store_checkouts, public.evo_store_checkout_items
  from public, anon, authenticated;
grant select on table public.evo_store_checkouts, public.evo_store_checkout_items to authenticated;
grant select, insert, update, delete on table public.evo_store_checkouts, public.evo_store_checkout_items to service_role;

comment on table public.evo_store_checkouts is
  'Temporary Store reservation snapshots, isolated from Vault commerce. evo_store_inventory.quantity_reserved remains aggregate reservation authority; this schema has no inventory effects. Future transactional RPCs own writes.';
comment on table public.evo_store_checkout_items is
  'Immutable commercial/reservation snapshots. Future RPC verifies variant/product ownership and authors prices; browser cart, prices and subtotal are never authority.';
comment on column public.evo_store_checkouts.subtotal is
  'Authoritative subtotal authored at checkout creation by the future transactional RPC.';
comment on column public.evo_store_checkouts.shipping_total is 'NULL means shipping not calculated.';
comment on column public.evo_store_checkouts.tax_total is 'NULL means tax not calculated.';
comment on column public.evo_store_checkouts.grand_total is 'NULL means total not finalized.';
comment on column public.evo_store_checkouts.expires_at is
  'Future creation RPC authors transaction_timestamp() + interval 30 minutes; no browser clock authority.';
comment on column public.evo_store_checkouts.address_id is
  'Optional source reference only; saved address edits/deletion never alter the independent shipping snapshot. Future RPC verifies source ownership.';
comment on column public.evo_store_checkouts.shipping_full_name is
  'Complete shipping snapshot required at creation; immutable to customers/staff through SELECT-only grants. Privileged future RPCs own lifecycle writes. V1 billing defaults to shipping.';
