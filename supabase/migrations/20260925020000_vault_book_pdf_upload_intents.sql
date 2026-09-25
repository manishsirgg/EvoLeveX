create table public.evo_vault_book_pdf_uploads (
  id uuid primary key default gen_random_uuid(),
  vault_product_id uuid not null references public.evo_vault_products(id) on delete cascade,
  storage_path text not null unique,
  expected_file_path text,
  created_at timestamptz not null default now()
);

alter table public.evo_vault_book_pdf_uploads enable row level security;

create policy "Staff manage Vault book PDF upload intents"
on public.evo_vault_book_pdf_uploads
for all
to authenticated
using (private.is_staff())
with check (private.is_staff());

grant select, insert, update, delete on public.evo_vault_book_pdf_uploads to authenticated;
