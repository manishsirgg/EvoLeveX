-- Evo Store V1 Stage 1B Phase 2E prerequisite: archived-product variant guard.

create or replace function private.guard_evo_store_archived_product_variants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row record;
begin
  -- Product archival and variant mutations serialize on the same parent rows.
  -- UUID ordering gives cross-product reassignment a deterministic lock order.
  for product_row in
    select product.id, product.publication_status
    from public.evo_store_products product
    where product.id in (
      case when tg_op <> 'INSERT' then old.product_id end,
      case when tg_op <> 'DELETE' then new.product_id end
    )
    order by product.id
    for update
  loop
    if product_row.publication_status = 'archived'::public.evo_store_publication_status then
      raise exception using errcode = 'P0001', message = 'EVO_STORE_VARIANT_ARCHIVED_PRODUCT';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_evo_store_archived_product_variants()
  from public, anon, authenticated;

create trigger evo_store_variants_guard_archived
before insert or update or delete on public.evo_store_variants
for each row execute function private.guard_evo_store_archived_product_variants();
