-- Evo Store V1 Stage 1B Phase 2G prerequisite: archived-product inventory guard.

create or replace function private.guard_evo_store_archived_product_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row record;
begin
  -- Resolve both possible variant owners, then take every parent lock in UUID
  -- order. This also protects the otherwise unsupported reassignment case.
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
        message = 'EVO_STORE_INVENTORY_ARCHIVED_PRODUCT';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_evo_store_archived_product_inventory()
  from public, anon, authenticated;

create trigger evo_store_inventory_guard_archived
before insert or update or delete on public.evo_store_inventory
for each row execute function private.guard_evo_store_archived_product_inventory();

create or replace function public.adjust_evo_store_inventory(
  p_variant_id uuid, p_mode text, p_quantity integer, p_reason text
)
returns table (
  variant_id uuid, quantity_on_hand integer, quantity_reserved integer,
  available_quantity integer, low_stock_threshold integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inventory_row public.evo_store_inventory%rowtype;
  movement_delta integer;
  owning_product_id uuid;
  owning_product_status public.evo_store_publication_status;
begin
  if not coalesce(private.is_staff(), false) then
    raise exception using errcode = '42501', message = 'staff access required';
  end if;
  if p_mode is null or p_mode not in ('initialize', 'adjust', 'set') then
    raise exception using errcode = '22023', message = 'invalid inventory mode';
  end if;
  if p_reason is null or p_reason not in
    ('initial_stock', 'stock_received', 'stock_count', 'damage', 'loss', 'manual_correction') then
    raise exception using errcode = '22023', message = 'invalid inventory reason';
  end if;
  if (p_mode = 'initialize') <> (p_reason = 'initial_stock') then
    raise exception using errcode = '22023', message = 'initial_stock is only valid for initialize mode';
  end if;
  if p_quantity is null then
    raise exception using errcode = '22004', message = 'inventory quantity is required';
  end if;

  -- Product-first locking aligns inventory with every other Store child guard.
  -- The variant lookup deliberately does not lock the child ahead of its parent.
  select variant.product_id into owning_product_id
  from public.evo_store_variants variant
  where variant.id = p_variant_id;
  if not found then
    raise exception using errcode = '23503', message = 'inventory variant does not exist';
  end if;

  select product.publication_status into owning_product_status
  from public.evo_store_products product
  where product.id = owning_product_id
  for update;

  if owning_product_status = 'archived'::public.evo_store_publication_status then
    raise exception using
      errcode = 'P0001',
      message = 'EVO_STORE_INVENTORY_ARCHIVED_PRODUCT';
  end if;

  if p_mode = 'initialize' then
    if p_quantity < 0 then
      raise exception using errcode = '22023', message = 'initial quantity cannot be negative';
    end if;
    insert into public.evo_store_inventory (variant_id, quantity_on_hand, quantity_reserved)
    values (p_variant_id, p_quantity, 0)
    returning * into inventory_row;
    movement_delta := p_quantity;
  else
    select * into inventory_row from public.evo_store_inventory
    where evo_store_inventory.variant_id = p_variant_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'inventory row does not exist';
    end if;
    if p_mode = 'adjust' then
      if p_quantity = 0 then
        raise exception using errcode = '22023', message = 'adjust quantity must be non-zero';
      end if;
      movement_delta := p_quantity;
    else
      if p_quantity < 0 then
        raise exception using errcode = '22023', message = 'set quantity cannot be negative';
      end if;
      movement_delta := p_quantity - inventory_row.quantity_on_hand;
      if movement_delta = 0 then
        raise exception using errcode = '22023', message = 'set quantity must change stock';
      end if;
    end if;
    if inventory_row.quantity_on_hand + movement_delta < 0 then
      raise exception using errcode = '22023', message = 'resulting stock cannot be negative';
    end if;
    if inventory_row.quantity_on_hand + movement_delta < inventory_row.quantity_reserved then
      raise exception using errcode = '22023', message = 'resulting stock cannot be below reserved stock';
    end if;
    update public.evo_store_inventory inventory
    set quantity_on_hand = inventory.quantity_on_hand + movement_delta
    where inventory.variant_id = p_variant_id
    returning * into inventory_row;
  end if;

  -- A zero-stock initialization intentionally creates no meaningless movement.
  if movement_delta <> 0 then
    insert into public.evo_store_inventory_movements
      (variant_id, quantity_change, reason, created_by)
    values (p_variant_id, movement_delta, p_reason, auth.uid());
  end if;
  return query select inventory_row.variant_id, inventory_row.quantity_on_hand,
    inventory_row.quantity_reserved,
    inventory_row.quantity_on_hand - inventory_row.quantity_reserved,
    inventory_row.low_stock_threshold;
end;
$$;

-- Restate the existing public contract explicitly after replacement.
revoke all on function public.adjust_evo_store_inventory(uuid, text, integer, text)
  from public, anon;
grant execute on function public.adjust_evo_store_inventory(uuid, text, integer, text)
  to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on table public.evo_store_inventory from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.evo_store_inventory_movements from authenticated;
