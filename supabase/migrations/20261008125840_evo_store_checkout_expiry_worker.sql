-- Phase 2J-C step 1: database only. No scheduler and no stock consumption.
-- This record is transactional, NOT an autonomous error log. An aborted caller
-- transaction rolls it back together with all releases. No customer data stored.
create table private.evo_store_checkout_expiry_failures (
  checkout_id uuid primary key references public.evo_store_checkouts(id) on delete cascade,
  error_code text not null check (error_code = 'EVO_STORE_CHECKOUT_RECONCILIATION_REQUIRED'),
  attempts integer not null check (attempts between 1 and 1000),
  last_failed_at timestamptz not null,
  retry_after timestamptz not null check (retry_after > last_failed_at)
);
alter table private.evo_store_checkout_expiry_failures enable row level security;
revoke all on table private.evo_store_checkout_expiry_failures from public, anon, authenticated, service_role;

create function public.expire_evo_store_checkouts(p_batch_size integer default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := pg_catalog.transaction_timestamp();
  candidate record;
  locked_checkout uuid;
  claimed uuid[] := '{}'::uuid[];
  variants uuid[];
  products uuid[];
  hold_id uuid;
  examined integer := 0;
  busy integer := 0;
  expired integer := 0;
  failed integer := 0;
  failure_message text;
begin
  if p_batch_size is null or p_batch_size not between 1 and 25 then
    raise exception using errcode = '22023', message = 'EVO_STORE_CHECKOUT_EXPIRY_BATCH_INVALID';
  end if;
  -- Bounded deterministic discovery; deferred poison rows do not consume the
  -- candidate allowance. Unfailed candidates precede due failures so poison
  -- cannot monopolize a small batch even if invocations exceed the backoff.
  -- SKIP LOCKED is used only AFTER the user try-lock.
  for candidate in
    select c.id, c.user_id from public.evo_store_checkouts c
    left join private.evo_store_checkout_expiry_failures f on f.checkout_id = c.id
    where c.status = 'active' and c.expires_at <= cutoff
      and (f.checkout_id is null or f.retry_after <= cutoff)
    order by (f.checkout_id is not null), c.expires_at, c.id limit 100
  loop
    examined := examined + 1;
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
        'evo_store_checkout:user:' || candidate.user_id::text, 0)) then
      busy := busy + 1;
      continue;
    end if;
    locked_checkout := null;
    select c.id into locked_checkout from public.evo_store_checkouts c
      where c.id = candidate.id and c.user_id = candidate.user_id
        and c.status = 'active' and c.expires_at <= cutoff
      for update skip locked;
    if locked_checkout is null then
      busy := busy + 1;
      continue;
    end if;
    claimed := pg_catalog.array_append(claimed, locked_checkout);
    exit when pg_catalog.cardinality(claimed) = p_batch_size;
  end loop;

  -- All lifecycle/user/header locks precede the complete sorted parent/stock
  -- union. Acquire these OUTSIDE the per-checkout subtransactions: a failed
  -- transition must not release locks or require acquiring lower UUIDs later.
  select pg_catalog.array_agg(distinct i.variant_id), pg_catalog.array_agg(distinct i.product_id)
    into variants, products from public.evo_store_checkout_items i where i.checkout_id = any(claimed);
  perform private.lock_evo_store_checkout_inventory(variants, products);

  foreach hold_id in array claimed loop
    begin
      perform private.finish_evo_store_checkout_hold(hold_id, 'expired');
      delete from private.evo_store_checkout_expiry_failures f where f.checkout_id = hold_id;
      expired := expired + 1;
    exception when sqlstate 'P0001' then
      get stacked diagnostics failure_message = message_text;
      if failure_message <> 'EVO_STORE_CHECKOUT_RECONCILIATION_REQUIRED' then
        raise;
      end if;
      -- PL/pgSQL rolled back THIS transition before entering the handler;
      -- outer lock set survives. Retain the active hold, never clamp stock.
      insert into private.evo_store_checkout_expiry_failures as failure
        (checkout_id, error_code, attempts, last_failed_at, retry_after)
      values (hold_id, failure_message, 1, cutoff, cutoff + interval '1 minute')
      on conflict on constraint evo_store_checkout_expiry_failures_pkey do update
        set attempts = least(failure.attempts + 1, 1000), last_failed_at = cutoff,
            retry_after = cutoff + interval '1 minute' * least(failure.attempts + 1, 60);
      failed := failed + 1;
    end;
  end loop;
  -- Counts only; no identifiers, snapshots, addresses, fingerprints or errors
  -- containing database details. Zero expired does NOT establish an empty queue.
  return pg_catalog.jsonb_build_object('examined', examined,
    'claimed', pg_catalog.cardinality(claimed), 'expired', expired,
    'busy', busy, 'reconciliation_failed', failed,
    'scan_limit_reached', examined = 100, 'batch_limit_reached', pg_catalog.cardinality(claimed) = p_batch_size);
end;
$$;
revoke all on function public.expire_evo_store_checkouts(integer) from public, anon, authenticated;
grant execute on function public.expire_evo_store_checkouts(integer) to service_role;
