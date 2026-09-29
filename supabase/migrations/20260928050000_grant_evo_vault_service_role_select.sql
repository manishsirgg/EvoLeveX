-- Trusted server-only Evo Vault library infrastructure reads product metadata.
grant select on table public.evo_vault_products to service_role;

-- Trusted server-only Evo Vault digital-delivery infrastructure reads book metadata.
grant select on table public.evo_vault_books to service_role;
