-- Atomic, RLS-respecting customer default shipping address selection.
-- This function never changes address ownership or payment/order records.
create or replace function public.set_default_shipping_address(p_address_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_address_id is null then
    raise exception 'SHIPPING_ADDRESS_NOT_AVAILABLE' using errcode = '22023';
  end if;

  -- Serialize concurrent default changes for this customer. All statements
  -- run in the same transaction, including the reset and new default update.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 358)
  );

  -- Ownership must be verified before clearing the previous default.
  perform 1 from public.addresses
    where id = p_address_id and user_id = v_user_id
    for update;
  if not found then
    raise exception 'SHIPPING_ADDRESS_NOT_AVAILABLE' using errcode = '22023';
  end if;

  update public.addresses
    set is_default = false
    where user_id = v_user_id and is_default = true and id <> p_address_id;

  update public.addresses
    set is_default = true
    where user_id = v_user_id and id = p_address_id;
  if not found then
    raise exception 'SHIPPING_ADDRESS_NOT_AVAILABLE' using errcode = '22023';
  end if;

  return true;
end;
$$;

revoke all on function public.set_default_shipping_address(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_default_shipping_address(uuid) to authenticated;
