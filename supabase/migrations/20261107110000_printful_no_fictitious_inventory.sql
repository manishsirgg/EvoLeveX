-- Do not represent Printful on-demand capacity as merchant warehouse stock.
-- Existing POD publication and variant activation locks remain unchanged.
create or replace function private.guard_evo_store_printful_fictitious_inventory()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.quantity_on_hand > 0 and exists (
  select 1 from private.evo_store_printful_variant_maps m
  where m.variant_id = new.variant_id
 ) then
  raise exception 'PRINTFUL_WAREHOUSE_STOCK_NOT_SUPPORTED' using errcode = '23514';
 end if;
 return new;
end;
$$;
revoke all on function private.guard_evo_store_printful_fictitious_inventory()
 from public,anon,authenticated,service_role;
create trigger evo_store_printful_no_fictitious_stock
before insert or update of quantity_on_hand,variant_id on public.evo_store_inventory
for each row execute function private.guard_evo_store_printful_fictitious_inventory();

-- Mapping an already-stocked warehouse SKU into POD is also prohibited;
-- the mapping transition must not silently reinterpret physical inventory.
create or replace function private.guard_evo_store_printful_mapping_existing_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists (
  select 1 from public.evo_store_inventory i
  where i.variant_id = new.variant_id and i.quantity_on_hand > 0
 ) then
  raise exception 'PRINTFUL_MAPPING_HAS_WAREHOUSE_STOCK' using errcode = '23514';
 end if;
 return new;
end;
$$;
revoke all on function private.guard_evo_store_printful_mapping_existing_stock()
 from public,anon,authenticated,service_role;
create trigger evo_store_printful_mapping_no_warehouse_stock
before insert or update of variant_id on private.evo_store_printful_variant_maps
for each row execute function private.guard_evo_store_printful_mapping_existing_stock();
