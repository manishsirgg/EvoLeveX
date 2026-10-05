-- Evo Store V1 Stage 1B Phase 1: staff catalog inspection and inventory support.

create or replace function public.inspect_evo_store_product_readiness(p_product_id uuid)
returns table (code text, scope text, variant_id uuid, message_key text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  product_row public.evo_store_products%rowtype;
begin
  if not coalesce(private.is_staff(), false) then
    raise exception using errcode = '42501', message = 'staff access required';
  end if;

  select * into product_row from public.evo_store_products where id = p_product_id;
  if not found then
    return query select 'EVO_STORE_READY_PRODUCT_NOT_FOUND', 'product', null::uuid,
      'evo_store.readiness.product_not_found';
    return;
  end if;
  if product_row.product_mode <> 'physical'::public.product_mode then
    return query select 'EVO_STORE_READY_PHYSICAL_REQUIRED', 'product', null::uuid,
      'evo_store.readiness.physical_required';
  end if;
  if product_row.category_id is null or not exists (
    select 1 from public.evo_store_categories c
    where c.id = product_row.category_id and c.is_active
  ) then
    return query select 'EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED', 'product', null::uuid,
      'evo_store.readiness.active_category_required';
  end if;
  if not exists (select 1 from public.evo_store_product_images i where i.product_id = p_product_id and i.is_active) then
    return query select 'EVO_STORE_READY_IMAGE_REQUIRED', 'product', null::uuid,
      'evo_store.readiness.image_required';
  end if;
  if (select count(*) from public.evo_store_product_images i
      where i.product_id = p_product_id and i.is_active and i.is_primary) <> 1 then
    return query select 'EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED', 'product', null::uuid,
      'evo_store.readiness.primary_image_required';
  end if;
  if not exists (select 1 from public.evo_store_variants v where v.product_id = p_product_id and v.is_active) then
    return query select 'EVO_STORE_READY_ACTIVE_VARIANT_REQUIRED', 'product', null::uuid,
      'evo_store.readiness.active_variant_required';
  end if;
  return query
    select 'EVO_STORE_READY_VARIANT_WEIGHT_REQUIRED', 'variant', v.id,
      'evo_store.readiness.variant_weight_required'
    from public.evo_store_variants v
    where v.product_id = p_product_id and v.is_active and (v.weight_g is null or v.weight_g <= 0)
    order by v.id;
  return query
    select 'EVO_STORE_READY_VARIANT_INVENTORY_REQUIRED', 'variant', v.id,
      'evo_store.readiness.variant_inventory_required'
    from public.evo_store_variants v
    where v.product_id = p_product_id and v.is_active
      and not exists (select 1 from public.evo_store_inventory i where i.variant_id = v.id)
    order by v.id;
  return query
    select 'EVO_STORE_READY_VARIANT_PRICE_REQUIRED', 'variant', v.id,
      'evo_store.readiness.variant_price_required'
    from public.evo_store_variants v
    where v.product_id = p_product_id and v.is_active
      and not exists (select 1 from public.evo_store_variant_prices p
                      where p.variant_id = v.id and p.is_active and p.amount > 0)
    order by v.id;
end;
$$;

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

  perform 1 from public.evo_store_variants where id = p_variant_id for key share;
  if not found then
    raise exception using errcode = '23503', message = 'inventory variant does not exist';
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
    update public.evo_store_inventory i
    set quantity_on_hand = i.quantity_on_hand + movement_delta
    where i.variant_id = p_variant_id
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

create or replace function public.get_evo_store_variant_availability(p_variant_ids uuid[])
returns table (variant_id uuid, availability text)
language sql
stable
security definer
set search_path = ''
as $$
  select requested.variant_id,
    case
      when variant.id is null
        or not variant.is_active
        or product.publication_status <> 'published'::public.evo_store_publication_status
        or not product.is_active
        or product.product_mode <> 'physical'::public.product_mode
        or category.id is null
        or inventory.variant_id is null
        or variant.weight_g is null or variant.weight_g <= 0
        or not exists (select 1 from public.evo_store_product_images image
                       where image.product_id = product.id and image.is_active)
        or (select count(*) from public.evo_store_product_images image
            where image.product_id = product.id and image.is_active and image.is_primary) <> 1
        or not exists (select 1 from public.evo_store_variant_prices price
                       where price.variant_id = variant.id and price.is_active and price.amount > 0)
      then 'unavailable'
      when inventory.quantity_on_hand - inventory.quantity_reserved > 0 then 'in_stock'
      else 'out_of_stock'
    end
  from (select distinct id as variant_id from pg_catalog.unnest(p_variant_ids) id where id is not null) requested
  left join public.evo_store_variants variant on variant.id = requested.variant_id
  left join public.evo_store_products product on product.id = variant.product_id
  left join public.evo_store_categories category on category.id = product.category_id and category.is_active
  left join public.evo_store_inventory inventory on inventory.variant_id = variant.id
  order by requested.variant_id;
$$;

revoke all on function public.inspect_evo_store_product_readiness(uuid) from public, anon;
grant execute on function public.inspect_evo_store_product_readiness(uuid) to authenticated;
revoke all on function public.adjust_evo_store_inventory(uuid, text, integer, text) from public, anon;
grant execute on function public.adjust_evo_store_inventory(uuid, text, integer, text) to authenticated;
revoke all on function public.get_evo_store_variant_availability(uuid[]) from public;
grant execute on function public.get_evo_store_variant_availability(uuid[]) to anon, authenticated;

revoke all on table public.evo_store_inventory from anon;
revoke insert, update, delete, truncate, references, trigger on table public.evo_store_inventory from authenticated;
grant select on table public.evo_store_inventory to authenticated;
revoke all on table public.evo_store_inventory_movements from anon;
revoke insert, update, delete, truncate, references, trigger on table public.evo_store_inventory_movements from authenticated;
grant select on table public.evo_store_inventory_movements to authenticated;
