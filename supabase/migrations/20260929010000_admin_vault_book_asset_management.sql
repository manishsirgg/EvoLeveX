alter table public.evo_vault_book_pdf_uploads
  add column target_asset_id uuid
    references public.evo_vault_book_assets(id) on delete cascade;

create or replace function public.normalize_evo_vault_book_assets(
  p_product_id uuid,
  p_preferred_primary_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_primary_id uuid;
begin
  -- The book row is the per-product mutex for every asset mutation.
  perform 1 from public.evo_vault_books
  where vault_product_id = p_product_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Vault book not found';
  end if;

  select asset.id into selected_primary_id
  from public.evo_vault_book_assets asset
  where asset.vault_product_id = p_product_id
    and asset.is_active
    and (asset.id = p_preferred_primary_id or (p_preferred_primary_id is null and asset.is_primary))
  order by (asset.id = p_preferred_primary_id) desc, asset.sort_order, asset.created_at, asset.id
  limit 1;

  if selected_primary_id is null then
    select asset.id into selected_primary_id
    from public.evo_vault_book_assets asset
    where asset.vault_product_id = p_product_id and asset.is_active
    order by asset.sort_order, asset.created_at, asset.id
    limit 1;
  end if;

  -- Clear first so changing primary never transiently violates the partial unique index.
  update public.evo_vault_book_assets
  set is_primary = false
  where vault_product_id = p_product_id and is_primary;

  with ordered as (
    select id, row_number() over (order by sort_order, created_at, id) - 1 as normalized_order
    from public.evo_vault_book_assets
    where vault_product_id = p_product_id and is_active
  )
  update public.evo_vault_book_assets asset
  set sort_order = ordered.normalized_order
  from ordered
  where asset.id = ordered.id and asset.sort_order <> ordered.normalized_order;

  update public.evo_vault_book_assets
  set is_primary = true
  where id = selected_primary_id;

  update public.evo_vault_books book
  set digital_file_path = primary_asset.file_path,
      digital_file_size = primary_asset.file_size,
      updated_at = now()
  from public.evo_vault_book_assets primary_asset
  where book.vault_product_id = p_product_id
    and primary_asset.id = selected_primary_id;

  if selected_primary_id is null then
    update public.evo_vault_books
    set digital_file_path = null, digital_file_size = null, updated_at = now()
    where vault_product_id = p_product_id;
  end if;

  return selected_primary_id;
end;
$$;

create or replace function public.finalize_evo_vault_book_asset_upload(
  p_product_id uuid,
  p_asset_id uuid,
  p_title text,
  p_file_path text,
  p_file_size bigint,
  p_expected_file_path text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  previous_path text;
  saved_asset_id uuid;
  next_order integer;
begin
  perform 1 from public.evo_vault_books where vault_product_id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Vault book not found'; end if;
  if nullif(btrim(p_title), '') is null then raise exception using errcode = '22023', message = 'Asset title is required'; end if;
  if p_file_size <= 0 or p_file_size > 52428800 then raise exception using errcode = '22023', message = 'Invalid PDF size'; end if;
  if p_file_path !~ ('^vault/' || p_product_id::text || '/books/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.pdf$') then
    raise exception using errcode = '22023', message = 'Invalid managed PDF path';
  end if;

  if p_asset_id is null then
    if p_expected_file_path is not null then raise exception using errcode = '22023', message = 'New asset cannot have an expected path'; end if;
    select coalesce(max(sort_order) + 1, 0) into next_order
    from public.evo_vault_book_assets where vault_product_id = p_product_id and is_active;
    insert into public.evo_vault_book_assets
      (vault_product_id, title, file_path, file_size, mime_type, sort_order, is_primary, is_active)
    values
      (p_product_id, btrim(p_title), p_file_path, p_file_size, 'application/pdf', next_order, false, true)
    returning id into saved_asset_id;
  else
    select file_path into previous_path
    from public.evo_vault_book_assets
    where id = p_asset_id and vault_product_id = p_product_id
    for update;
    if not found or previous_path is distinct from p_expected_file_path then
      raise exception using errcode = '40001', message = 'The asset changed while the replacement was uploading';
    end if;
    update public.evo_vault_book_assets
    set title = btrim(p_title), file_path = p_file_path, file_size = p_file_size,
        mime_type = 'application/pdf', is_active = true
    where id = p_asset_id
    returning id into saved_asset_id;
  end if;

  perform public.normalize_evo_vault_book_assets(p_product_id, null);
  return jsonb_build_object('asset_id', saved_asset_id, 'previous_file_path', previous_path);
end;
$$;

create or replace function public.mutate_evo_vault_book_asset(
  p_product_id uuid,
  p_asset_id uuid,
  p_operation text,
  p_title text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target public.evo_vault_book_assets%rowtype;
  swap_id uuid;
  preferred_primary uuid;
begin
  perform 1 from public.evo_vault_books where vault_product_id = p_product_id for update;
  select * into target from public.evo_vault_book_assets
  where id = p_asset_id and vault_product_id = p_product_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Book asset not found'; end if;

  if p_operation = 'rename' then
    if nullif(btrim(p_title), '') is null then raise exception using errcode = '22023', message = 'Asset title is required'; end if;
    update public.evo_vault_book_assets set title = btrim(p_title) where id = target.id;
  elsif p_operation = 'primary' then
    if not target.is_active then raise exception using errcode = '22023', message = 'Inactive assets cannot be primary'; end if;
    preferred_primary := target.id;
  elsif p_operation in ('up', 'down') then
    if not target.is_active then raise exception using errcode = '22023', message = 'Inactive assets cannot be reordered'; end if;
    select id into swap_id from public.evo_vault_book_assets
    where vault_product_id = p_product_id and is_active
      and case when p_operation = 'up' then sort_order < target.sort_order else sort_order > target.sort_order end
    order by case when p_operation = 'up' then sort_order end desc,
             case when p_operation = 'down' then sort_order end asc,
             created_at, id limit 1;
    if swap_id is not null then
      update public.evo_vault_book_assets set sort_order = target.sort_order where id = swap_id;
      update public.evo_vault_book_assets
      set sort_order = case when p_operation = 'up' then greatest(target.sort_order - 1, 0) else target.sort_order + 1 end
      where id = target.id;
    end if;
  elsif p_operation = 'remove' then
    update public.evo_vault_book_assets set is_active = false, is_primary = false where id = target.id;
  else
    raise exception using errcode = '22023', message = 'Unsupported asset operation';
  end if;

  perform public.normalize_evo_vault_book_assets(p_product_id, preferred_primary);
  return jsonb_build_object(
    'removed_file_path', case when p_operation = 'remove' then target.file_path else null end
  );
end;
$$;

revoke all on function public.normalize_evo_vault_book_assets(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_evo_vault_book_asset_upload(uuid, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.mutate_evo_vault_book_asset(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.normalize_evo_vault_book_assets(uuid, uuid) to service_role;
grant execute on function public.finalize_evo_vault_book_asset_upload(uuid, uuid, text, text, bigint, text) to service_role;
grant execute on function public.mutate_evo_vault_book_asset(uuid, uuid, text, text) to service_role;

comment on function public.normalize_evo_vault_book_assets(uuid, uuid) is
  'Service-role-only atomic ordering, primary selection, and Stage 2B legacy book-field synchronization.';
