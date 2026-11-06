-- Merchant-entered bulk draft prices only. No activation or checkout side effects.
create or replace function public.seed_evo_store_inactive_draft_prices(
 p_product_id uuid,p_currency text,p_prices jsonb
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
 v_count integer;
 v_variant_count integer;
 v_existing integer;
 v_line jsonb;
begin
 if auth.uid() is null or not coalesce(private.is_staff(), false) then
  raise exception 'STORE_PRICING_UNAUTHORIZED' using errcode='42501';
 end if;
 if p_product_id is null or p_currency is null
  or not private.evo_store_currency_supported(p_currency)
  or p_prices is null or jsonb_typeof(p_prices) <> 'array' then
  raise exception 'STORE_PRICING_INVALID_INPUT' using errcode='22023';
 end if;
 v_count := jsonb_array_length(p_prices);
 if v_count < 1 or v_count > 50 then
  raise exception 'STORE_PRICING_INVALID_COUNT' using errcode='22023';
 end if;
 -- Serialize concurrent changes to this draft, preventing partial inserts.
 perform 1 from public.evo_store_products
  where id=p_product_id and publication_status='draft' for update;
 if not found then
  raise exception 'STORE_PRICING_DRAFT_REQUIRED' using errcode='22023';
 end if;
 select count(*) into v_variant_count from public.evo_store_variants
  where product_id=p_product_id;
 if v_count <> v_variant_count then
  raise exception 'STORE_PRICING_ALL_VARIANTS_REQUIRED' using errcode='22023';
 end if;
 -- Reject duplicated IDs, foreign variants, malformed monetary strings,
 -- and any conflicting price row before writing.
 if exists (
  select 1 from jsonb_array_elements(p_prices) as item(v)
  where jsonb_typeof(item.v)<>'object'
    or (select count(*) from jsonb_object_keys(item.v))<>2
    or jsonb_typeof(item.v->'variant_id')<>'string'
    or jsonb_typeof(item.v->'amount')<>'string'
    or (item.v->>'variant_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or (item.v->>'amount') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$'
    or (item.v->>'amount')::numeric<=0
    or (p_currency='JPY' and (item.v->>'amount')::numeric<>trunc((item.v->>'amount')::numeric))
 ) then
  raise exception 'STORE_PRICING_INVALID_LINES' using errcode='22023';
 end if;
 if (select count(distinct item.v->>'variant_id') from jsonb_array_elements(p_prices) as item(v))<>v_count
  or exists (
   select 1 from jsonb_array_elements(p_prices) as item(v)
    where not exists (
     select 1 from public.evo_store_variants v
      where v.id::text=item.v->>'variant_id' and v.product_id=p_product_id
    )
  ) then
  raise exception 'STORE_PRICING_VARIANT_MISMATCH' using errcode='22023';
 end if;
 select count(*) into v_existing
 from public.evo_store_variant_prices p
 join public.evo_store_variants v on v.id=p.variant_id
 where v.product_id=p_product_id and p.currency=p_currency::char(3);
 if v_existing>0 then
  raise exception 'STORE_PRICING_ALREADY_EXISTS' using errcode='23505';
 end if;
 insert into public.evo_store_variant_prices(variant_id,currency,amount,is_active)
 select (item.v->>'variant_id')::uuid,p_currency::char(3),(item.v->>'amount')::numeric,false
 from jsonb_array_elements(p_prices) as item(v);
 return v_count;
end;
$$;
revoke all on function public.seed_evo_store_inactive_draft_prices(uuid,text,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.seed_evo_store_inactive_draft_prices(uuid,text,jsonb)
 to authenticated;
