-- Parent and subtype writes must succeed or fail together. This security-invoker
-- function preserves the caller's identity, so the existing table RLS remains authoritative.
create or replace function public.save_evo_vault_product(
  p_product_id uuid,
  p_parent jsonb,
  p_subtype jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_id uuid;
  product_kind public.vault_product_kind := (p_parent->>'kind')::public.vault_product_kind;
begin
  if p_product_id is null then
    insert into public.evo_vault_products (
      kind, name, slug, description, short_description, product_mode, price, currency,
      cover_image_url, is_active, is_featured, sort_order, seo_title, seo_description
    ) values (
      product_kind, p_parent->>'name', p_parent->>'slug', p_parent->>'description', p_parent->>'short_description',
      (p_parent->>'product_mode')::public.product_mode, (p_parent->>'price')::numeric, 'INR',
      p_parent->>'cover_image_url', (p_parent->>'is_active')::boolean, (p_parent->>'is_featured')::boolean,
      (p_parent->>'sort_order')::integer, p_parent->>'seo_title', p_parent->>'seo_description'
    ) returning id into saved_id;
  else
    update public.evo_vault_products set
      name = p_parent->>'name', slug = p_parent->>'slug', description = p_parent->>'description',
      short_description = p_parent->>'short_description', product_mode = (p_parent->>'product_mode')::public.product_mode,
      price = (p_parent->>'price')::numeric, cover_image_url = p_parent->>'cover_image_url',
      is_active = (p_parent->>'is_active')::boolean, is_featured = (p_parent->>'is_featured')::boolean,
      sort_order = (p_parent->>'sort_order')::integer, seo_title = p_parent->>'seo_title',
      seo_description = p_parent->>'seo_description', updated_at = now()
    where id = p_product_id and kind = product_kind
    returning id into saved_id;
    if saved_id is null then raise exception 'Vault product not found or kind mismatch'; end if;
  end if;

  if product_kind = 'book' then
    insert into public.evo_vault_books (vault_product_id, author_name, isbn, page_count, physical_weight_g, preview_text)
    values (saved_id, p_subtype->>'author_name', p_subtype->>'isbn', (p_subtype->>'page_count')::integer, (p_subtype->>'physical_weight_g')::integer, p_subtype->>'preview_text')
    on conflict (vault_product_id) do update set author_name = excluded.author_name, isbn = excluded.isbn,
      page_count = excluded.page_count, physical_weight_g = excluded.physical_weight_g,
      preview_text = excluded.preview_text, updated_at = now();
  else
    insert into public.evo_vault_courses (vault_product_id, instructor_id, subtitle, level, duration_minutes, certificate_available, preview_video_url)
    values (saved_id, (p_subtype->>'instructor_id')::uuid, p_subtype->>'subtitle', p_subtype->>'level',
      (p_subtype->>'duration_minutes')::integer, (p_subtype->>'certificate_available')::boolean, p_subtype->>'preview_video_url')
    on conflict (vault_product_id) do update set instructor_id = excluded.instructor_id, subtitle = excluded.subtitle,
      level = excluded.level, duration_minutes = excluded.duration_minutes, certificate_available = excluded.certificate_available,
      preview_video_url = excluded.preview_video_url, updated_at = now();
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_evo_vault_product(uuid, jsonb, jsonb) from public;
grant execute on function public.save_evo_vault_product(uuid, jsonb, jsonb) to authenticated;
