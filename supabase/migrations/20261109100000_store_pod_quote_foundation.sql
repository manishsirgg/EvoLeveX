-- Isolated, NON-PAYABLE Printful POD quote snapshot foundation.
-- No writer or reader role is granted. This migration cannot activate checkout,
-- publish mapped products, reserve inventory, or send payments/fulfilment orders.
begin;

create table private.evo_store_pod_quote_snapshots (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete restrict,
 idempotency_key uuid not null,
 printful_store_id uuid not null references private.evo_store_printful_stores(id) on delete restrict,
 currency char(3) not null check (private.evo_store_currency_supported(currency::text)),
 destination_country char(2) not null check (destination_country ~ '^[A-Z]{2}$'),
 -- A digest binds the full normalized destination, never store customer PII here.
 destination_digest text not null check (destination_digest ~ '^[a-f0-9]{64}$'),
 -- All monetary figures are exact, nonnegative, and limited to 2 decimal places.
 subtotal numeric(14,2) not null check (subtotal >= 0),
 shipping_total numeric(14,2) not null check (shipping_total >= 0),
 tax_total numeric(14,2) not null check (tax_total >= 0),
 grand_total numeric(14,2) generated always as (subtotal + shipping_total + tax_total) stored,
 provider_shipping_option text not null check (length(provider_shipping_option) between 1 and 60),
 provider_quote_observed_at timestamptz not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 status text not null default 'prepared' check (status in ('prepared','expired','invalidated')),
 payment_ready boolean not null default false check (payment_ready = false),
 fulfillment_ready boolean not null default false check (fulfillment_ready = false),
 constraint evo_store_pod_quote_ttl check (
   expires_at > created_at and expires_at <= created_at + interval '15 minutes'
 ),
 constraint evo_store_pod_quote_replay unique (customer_id,idempotency_key),
 constraint evo_store_pod_quote_id_store unique (id,printful_store_id)
);
create index evo_store_pod_quote_expiry_idx
 on private.evo_store_pod_quote_snapshots(expires_at)
 where status = 'prepared';
alter table private.evo_store_pod_quote_snapshots enable row level security;
revoke all on private.evo_store_pod_quote_snapshots from public,anon,authenticated,service_role;

create table private.evo_store_pod_quote_lines (
 quote_id uuid not null,
 printful_store_id uuid not null,
 line_number integer not null check (line_number between 1 and 50),
 product_map_id uuid not null,
 product_id uuid not null,
 variant_id uuid not null,
 -- Snapshot of the exact synchronized IDs, never inferred from SKU alone.
 sync_variant_id text not null check (sync_variant_id ~ '^[0-9]{1,30}$'),
 catalog_variant_id text not null check (catalog_variant_id ~ '^[0-9]{1,30}$'),
 quantity integer not null check (quantity between 1 and 10),
 sku text not null check (length(sku) between 1 and 64),
 unit_price numeric(14,2) not null check (unit_price > 0),
 line_subtotal numeric(14,2) generated always as (quantity * unit_price) stored,
 primary key(quote_id,line_number),
 constraint evo_store_pod_line_quote_fk foreign key (quote_id,printful_store_id)
  references private.evo_store_pod_quote_snapshots(id,printful_store_id) on delete restrict,
 constraint evo_store_pod_line_product_fk foreign key (product_map_id,product_id)
  references private.evo_store_printful_product_maps(id,product_id) on delete restrict,
 constraint evo_store_pod_line_variant_fk foreign key (variant_id,product_id)
  references public.evo_store_variants(id,product_id) on delete restrict,
 constraint evo_store_pod_line_provider_map_fk foreign key (variant_id)
  references private.evo_store_printful_variant_maps(variant_id) on delete restrict,
 constraint evo_store_pod_line_one_variant unique(quote_id,variant_id)
);
create index evo_store_pod_line_variant_idx on private.evo_store_pod_quote_lines(variant_id);
alter table private.evo_store_pod_quote_lines enable row level security;
revoke all on private.evo_store_pod_quote_lines from public,anon,authenticated,service_role;

comment on table private.evo_store_pod_quote_snapshots is
 'Locked POD quote evidence schema only. No grants, no customer route, no payment authorization. Future worker must transactionally validate destination, mapping, line totals, provider quote and TTL.';
comment on table private.evo_store_pod_quote_lines is
 'Immutable-intent candidate rows. A future restricted writer must verify IDs against private provider maps and exact line totals before inserting.';

commit;
