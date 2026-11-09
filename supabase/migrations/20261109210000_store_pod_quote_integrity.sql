-- POD quote persistence integrity. A quote is *not* payable or fulfillable.
-- Deferred constraints permit parent/line inserts in one transaction and validate
-- the complete quote at COMMIT. No grants, worker, route or customer checkout.
begin;

create function private.assert_evo_store_pod_quote_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_quote private.evo_store_pod_quote_snapshots%rowtype;
  v_line_count bigint;
  v_total numeric;
  v_invalid bigint;
begin
  if tg_table_name = 'evo_store_pod_quote_snapshots' then
    v_quote_id := new.id;
  elsif tg_op = 'DELETE' then
    v_quote_id := old.quote_id;
  else
    v_quote_id := new.quote_id;
  end if;

  -- Serialize concurrent changes to the same quote at validation time.
  select * into v_quote
    from private.evo_store_pod_quote_snapshots
    where id = v_quote_id
    for update;
  if not found then
    raise exception 'STORE_POD_QUOTE_HEADER_MISSING' using errcode = '23514';
  end if;

  select
    pg_catalog.count(*),
    pg_catalog.coalesce(pg_catalog.sum(l.line_subtotal), 0),
    pg_catalog.count(*) filter (where
      pm.id is null or vm.id is null or v.id is null
      or pm.store_id <> v_quote.printful_store_id
      or pm.product_id <> l.product_id
      or vm.product_map_id <> l.product_map_id
      or vm.product_id <> l.product_id
      or vm.variant_id <> l.variant_id
      or vm.sync_variant_id <> l.sync_variant_id
      or vm.catalog_variant_id <> l.catalog_variant_id
      or pm.sync_state <> 'synced'
      or vm.sync_state <> 'synced'
      or v.product_id <> l.product_id
      or v.sku <> l.sku
      or l.printful_store_id <> v_quote.printful_store_id
    )
  into v_line_count, v_total, v_invalid
  from private.evo_store_pod_quote_lines l
  left join private.evo_store_printful_product_maps pm
    on pm.id = l.product_map_id
  left join private.evo_store_printful_variant_maps vm
    on vm.variant_id = l.variant_id
  left join public.evo_store_variants v on v.id = l.variant_id
  where l.quote_id = v_quote_id;

  if v_line_count < 1 or v_line_count > 50
     or v_total <> v_quote.subtotal or v_invalid <> 0
  then
    raise exception 'STORE_POD_QUOTE_INTEGRITY_FAILED' using errcode = '23514';
  end if;

  -- These are evidence records, never payment/fulfilment authorization.
  if v_quote.payment_ready or v_quote.fulfillment_ready then
    raise exception 'STORE_POD_QUOTE_NON_PAYABLE' using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function private.assert_evo_store_pod_quote_integrity()
 from public, anon, authenticated, service_role;

create constraint trigger evo_store_pod_quote_header_integrity
after insert or update on private.evo_store_pod_quote_snapshots
deferrable initially deferred
for each row execute function private.assert_evo_store_pod_quote_integrity();

create constraint trigger evo_store_pod_quote_line_integrity
after insert or update or delete on private.evo_store_pod_quote_lines
deferrable initially deferred
for each row execute function private.assert_evo_store_pod_quote_integrity();

-- A later restricted writer must additionally reverify destination ownership,
-- tax, provider quote age, currency, production approval and idempotency,
-- and must write header + all lines in one transaction.
commit;
