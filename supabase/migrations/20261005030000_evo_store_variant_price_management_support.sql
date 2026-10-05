-- Evo Store V1 Stage 1B Phase 2F prerequisite: archived-product price guard.

create or replace function private.guard_evo_store_archived_product_variant_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row record;
begin
  -- Resolve ownership from the authoritative variant rows. Product archival and
  -- price mutations serialize on the same product locks; UUID ordering prevents
  -- cross-product price reassignment from taking those locks in opposite orders.
  for product_row in
    select product.id, product.publication_status
    from public.evo_store_products product
    where product.id in (
      select variant.product_id
      from public.evo_store_variants variant
      where variant.id in (
        case when tg_op <> 'INSERT' then old.variant_id end,
        case when tg_op <> 'DELETE' then new.variant_id end
      )
    )
    order by product.id
    for update
  loop
    if product_row.publication_status = 'archived'::public.evo_store_publication_status then
      raise exception using
        errcode = 'P0001',
        message = 'EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_evo_store_archived_product_variant_prices()
  from public, anon, authenticated;

create trigger evo_store_variant_prices_guard_archived
before insert or update or delete on public.evo_store_variant_prices
for each row execute function private.guard_evo_store_archived_product_variant_prices();
