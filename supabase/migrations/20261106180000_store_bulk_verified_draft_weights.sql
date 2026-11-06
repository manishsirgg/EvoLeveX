-- Atomic draft-only weight setup from individually merchant-verified shipping weights.
-- Never estimates weights from product names or enables publication / payments.
create or replace function public.seed_evo_store_verified_draft_weights(
 p_product_id uuid, p_weights jsonb
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
 v_count integer;
 v_variants integer;
 v_item jsonb;
 v_variant_id uuid;
 v_weight integer;
 v_seen uuid[] := '{}'::uuid[];
begin
 if auth.uid() is null or not coalesce(private.is_staff(), false) then
  raise exception 'STORE_WEIGHT_UNAUTHORIZED' using errcode='42501';
 end if;
 if p_product_id is null or p_weights is null or jsonb_typeof(p_weights)<>'array' then
  raise exception 'STORE_WEIGHT_INVALID_INPUT' using errcode='22023';
 end if;
 v_count := jsonb_array_length(p_weights);
 if v_count<1 or v_count>50 then
  raise exception 'STORE_WEIGHT_INVALID_COUNT' using errcode='22023';
 end if;
 perform 1 from public.evo_store_products
  where id=p_product_id and product_mode='physical' and publication_status='draft'
  for update;
 if not found then
  raise exception 'STORE_WEIGHT_DRAFT_REQUIRED' using errcode='22023';
 end if;
 select count(*) into v_variants from public.evo_store_variants
  where product_id=p_product_id;
 if v_variants<>v_count then
  raise exception 'STORE_WEIGHT_ALL_VARIANTS_REQUIRED' using errcode='22023';
 end if;
 -- No overwrite of previously verified weights. All values must be provided.
 if exists (select 1 from public.evo_store_variants
  where product_id=p_product_id and weight_g is not null) then
  raise exception 'STORE_WEIGHT_ALREADY_CONFIGURED' using errcode='23505';
 end if;
 for v_item in select value from jsonb_array_elements(p_weights)
 loop
  if jsonb_typeof(v_item)<>'object'
   or (select count(*) from jsonb_object_keys(v_item))<>2
   or jsonb_typeof(v_item->'variant_id')<>'string'
   or jsonb_typeof(v_item->'weight_g')<>'number'
   or (v_item->>'variant_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or (v_item->>'weight_g') !~ '^[1-9][0-9]{0,9}$'
  then
   raise exception 'STORE_WEIGHT_INVALID_LINE' using errcode='22023';
  end if;
  if (v_item->>'weight_g')::numeric>2147483647 then
   raise exception 'STORE_WEIGHT_OUT_OF_RANGE' using errcode='22023';
  end if;
  v_variant_id := (v_item->>'variant_id')::uuid;
  v_weight := (v_item->>'weight_g')::integer;
  if v_variant_id=any(v_seen) then
   raise exception 'STORE_WEIGHT_DUPLICATE_VARIANT' using errcode='22023';
  end if;
  v_seen:=array_append(v_seen,v_variant_id);
  if not exists (select 1 from public.evo_store_variants
   where id=v_variant_id and product_id=p_product_id) then
   raise exception 'STORE_WEIGHT_FOREIGN_VARIANT' using errcode='22023';
  end if;
 end loop;
 update public.evo_store_variants v set weight_g=(item.value->>'weight_g')::integer
 from jsonb_array_elements(p_weights) as item(value)
 where v.id=(item.value->>'variant_id')::uuid
  and v.product_id=p_product_id and v.weight_g is null;
 if not found then
  raise exception 'STORE_WEIGHT_UPDATE_FAILED' using errcode='22023';
 end if;
 return v_count;
end;
$$;
revoke all on function public.seed_evo_store_verified_draft_weights(uuid,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.seed_evo_store_verified_draft_weights(uuid,jsonb) to authenticated;
