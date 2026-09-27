create table public.evo_vault_product_prices (
  id uuid primary key default gen_random_uuid(),
  vault_product_id uuid not null
    references public.evo_vault_products(id) on delete cascade,
  currency bpchar not null,
  amount numeric(14,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evo_vault_product_prices_product_currency_key
    unique (vault_product_id, currency),
  constraint evo_vault_product_prices_amount_check
    check (amount >= 0),
  constraint evo_vault_product_prices_currency_supported_check
    check (currency in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY'))
);

comment on table public.evo_vault_product_prices is
  'Merchant-defined Evo Vault storefront prices, not live FX conversion results. Each product may have one configured amount per supported currency.';
comment on column public.evo_vault_product_prices.vault_product_id is
  'Evo Vault product whose legacy price and currency columns remain in use during the staged migration.';
comment on column public.evo_vault_product_prices.currency is
  'Supported storefront currency for this merchant-defined price.';
comment on column public.evo_vault_product_prices.amount is
  'Merchant-defined selling amount; no exchange-rate conversion is applied.';

create trigger evo_vault_product_prices_updated_at
before update on public.evo_vault_product_prices
for each row execute function public.set_updated_at();

insert into public.evo_vault_product_prices (
  vault_product_id,
  currency,
  amount,
  is_active
)
select
  id,
  currency,
  price,
  true
from public.evo_vault_products
on conflict (vault_product_id, currency) do nothing;

alter table public.evo_vault_product_prices enable row level security;

revoke all on table public.evo_vault_product_prices from anon, authenticated;
grant select on table public.evo_vault_product_prices to anon;
grant select, insert, update, delete on table public.evo_vault_product_prices to authenticated;

create policy evo_vault_product_prices_public_read
on public.evo_vault_product_prices
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.evo_vault_products
    where evo_vault_products.id = evo_vault_product_prices.vault_product_id
      and evo_vault_products.is_active = true
  )
);

create policy evo_vault_product_prices_staff_manage
on public.evo_vault_product_prices
for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));
