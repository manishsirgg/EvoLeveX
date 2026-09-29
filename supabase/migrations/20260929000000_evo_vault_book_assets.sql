create table public.evo_vault_book_assets (
  id uuid primary key default gen_random_uuid(),
  vault_product_id uuid not null,
  title text not null,
  file_path text not null,
  file_size bigint not null,
  mime_type text not null default 'application/pdf',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evo_vault_book_assets_vault_product_fkey
    foreign key (vault_product_id)
    references public.evo_vault_products(id)
    on delete cascade,
  constraint evo_vault_book_assets_book_fkey
    foreign key (vault_product_id)
    references public.evo_vault_books(vault_product_id)
    on delete cascade,
  constraint evo_vault_book_assets_title_check
    check (btrim(title) <> ''),
  constraint evo_vault_book_assets_file_path_key unique (file_path),
  constraint evo_vault_book_assets_file_path_check
    check (btrim(file_path) <> ''),
  constraint evo_vault_book_assets_file_size_check
    check (file_size > 0),
  constraint evo_vault_book_assets_mime_type_check
    check (mime_type = 'application/pdf'),
  constraint evo_vault_book_assets_sort_order_check
    check (sort_order >= 0)
);

create unique index evo_vault_book_assets_one_active_primary_idx
  on public.evo_vault_book_assets (vault_product_id)
  where is_primary = true and is_active = true;

create index evo_vault_book_assets_listing_idx
  on public.evo_vault_book_assets
  (vault_product_id, is_active, sort_order, created_at);

create trigger set_evo_vault_book_assets_updated_at
before update on public.evo_vault_book_assets
for each row execute function public.set_updated_at();

alter table public.evo_vault_book_assets enable row level security;

revoke all on table public.evo_vault_book_assets from anon, authenticated;
grant select, insert, update, delete on table public.evo_vault_book_assets to service_role;

insert into public.evo_vault_book_assets (
  vault_product_id,
  title,
  file_path,
  file_size,
  mime_type,
  sort_order,
  is_primary,
  is_active
)
select
  book.vault_product_id,
  'Book PDF',
  book.digital_file_path,
  book.digital_file_size,
  'application/pdf',
  0,
  true,
  true
from public.evo_vault_books as book
where btrim(book.digital_file_path) <> ''
  and book.digital_file_size > 0
on conflict (file_path) do nothing;

alter table public.digital_download_logs
  add column asset_id uuid,
  add constraint digital_download_logs_asset_id_fkey
    foreign key (asset_id)
    references public.evo_vault_book_assets(id)
    on delete set null;

create index digital_download_logs_asset_id_idx
  on public.digital_download_logs (asset_id)
  where asset_id is not null;

comment on table public.evo_vault_book_assets is
  'Canonical protected PDF assets belonging to Evo Vault book products.';

comment on column public.evo_vault_book_assets.file_path is
  'Private evo-private object path; never expose directly to customers.';

comment on column public.digital_download_logs.asset_id is
  'Downloaded book asset when known; nullable for legacy download flows and historical rows.';
