-- Printful Phase A3: private provider identity mappings only.
-- No changes to publication, stock, checkout, ordering or fulfillment.
-- Run as a reviewed, one-time migration; no token or customer data is stored.
begin;

create table private.evo_store_printful_stores (
  id uuid primary key default gen_random_uuid(),
  external_store_id text not null unique
    check (external_store_id ~ '^[0-9]{1,30}$'),
  display_name text not null
    check (length(btrim(display_name)) between 1 and 120),
  api_version text not null default 'v1'
    check (api_version = 'v1'),
  sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.evo_store_printful_stores enable row level security;
revoke all on private.evo_store_printful_stores from public, anon, authenticated, service_role;

create table private.evo_store_printful_product_maps (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references private.evo_store_printful_stores(id) on delete restrict,
  product_id uuid not null unique references public.evo_store_products(id) on delete restrict,
  sync_product_id text not null check (sync_product_id ~ '^[0-9]{1,30}$'),
  sync_state text not null default 'pending'
    check (sync_state in ('pending','synced','error','disabled')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evo_store_printful_product_map_store_sync_unique unique (store_id, sync_product_id),
  constraint evo_store_printful_product_map_id_product_unique unique (id, product_id)
);
alter table private.evo_store_printful_product_maps enable row level security;
revoke all on private.evo_store_printful_product_maps from public, anon, authenticated, service_role;

-- Composite FK ensures provider variant maps cannot point at another product.
-- A unique constraint on (id, product_id) adds no restriction on valid existing variants.
alter table public.evo_store_variants
  add constraint evo_store_variants_id_product_unique unique (id, product_id);

create table private.evo_store_printful_variant_maps (
  id uuid primary key default gen_random_uuid(),
  product_map_id uuid not null,
  product_id uuid not null,
  variant_id uuid not null unique,
  sync_variant_id text not null check (sync_variant_id ~ '^[0-9]{1,30}$'),
  catalog_variant_id text not null check (catalog_variant_id ~ '^[0-9]{1,30}$'),
  sync_state text not null default 'pending'
    check (sync_state in ('pending','synced','error','disabled')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evo_store_printful_variant_parent_fk foreign key (product_map_id, product_id)
    references private.evo_store_printful_product_maps(id, product_id)
    on update restrict on delete restrict,
  constraint evo_store_printful_variant_local_fk foreign key (variant_id, product_id)
    references public.evo_store_variants(id, product_id)
    on update restrict on delete restrict,
  constraint evo_store_printful_variant_map_sync_unique unique (product_map_id, sync_variant_id)
);
alter table private.evo_store_printful_variant_maps enable row level security;
revoke all on private.evo_store_printful_variant_maps from public, anon, authenticated, service_role;

create index evo_store_printful_variant_maps_product_idx
  on private.evo_store_printful_variant_maps(product_id);
create index evo_store_printful_product_maps_store_idx
  on private.evo_store_printful_product_maps(store_id);

create table private.evo_store_printful_sync_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references private.evo_store_printful_stores(id) on delete restrict,
  idempotency_key uuid not null,
  operation text not null check (operation in ('list_products','import_product','sync_product')),
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  imported_count integer not null default 0 check (imported_count >= 0),
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,80}$'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint evo_store_printful_sync_runs_unique unique (store_id,idempotency_key),
  constraint evo_store_printful_sync_runs_finish_check
    check ((status in ('completed','failed')) = (finished_at is not null))
);
alter table private.evo_store_printful_sync_runs enable row level security;
revoke all on private.evo_store_printful_sync_runs from public, anon, authenticated, service_role;

commit;
