create table public.evo_vault_product_images (
  id uuid primary key default gen_random_uuid(),
  vault_product_id uuid not null references public.evo_vault_products(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evo_vault_product_images_sort_order_check check (sort_order >= 0),
  constraint evo_vault_product_images_storage_object_key unique (storage_bucket, storage_path)
);

create index evo_vault_product_images_product_order_idx
  on public.evo_vault_product_images (vault_product_id, sort_order, created_at, id);

create trigger set_evo_vault_product_images_updated_at
before update on public.evo_vault_product_images
for each row execute function public.set_updated_at();

alter table public.evo_vault_product_images enable row level security;

revoke all on table public.evo_vault_product_images from anon, authenticated;
grant select on table public.evo_vault_product_images to anon;
grant select, insert, update, delete on table public.evo_vault_product_images to authenticated;

create policy "Public can read active Vault product images"
on public.evo_vault_product_images for select
to anon, authenticated
using (
  exists (
    select 1
    from public.evo_vault_products p
    where p.id = evo_vault_product_images.vault_product_id
      and p.is_active = true
  )
);

create policy "Staff can read all Vault product images"
on public.evo_vault_product_images for select
to authenticated
using (private.is_staff());

create policy "Staff can insert Vault product images"
on public.evo_vault_product_images for insert
to authenticated
with check (private.is_staff());

create policy "Staff can update Vault product images"
on public.evo_vault_product_images for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

create policy "Staff can delete Vault product images"
on public.evo_vault_product_images for delete
to authenticated
using (private.is_staff());
