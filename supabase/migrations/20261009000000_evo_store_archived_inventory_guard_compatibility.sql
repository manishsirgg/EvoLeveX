-- Restore omitted trigger wiring without replacing the Phase 2J-B function.
-- Run as the trusted postgres migration owner, after Phase 2J-A/B/C.
-- Serialize trigger inspection/creation with inventory writers and competing DDL.
do $repair$
declare
  guard_oid oid;
  guard pg_catalog.pg_proc%rowtype;
  wiring pg_catalog.pg_trigger%rowtype;
begin
  lock table public.evo_store_inventory in share row exclusive mode;
  guard_oid := pg_catalog.to_regprocedure('private.guard_evo_store_archived_product_inventory()');
  if guard_oid is null then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_INVENTORY_GUARD_PREREQUISITE';
  end if;
  select * into guard from pg_catalog.pg_proc where oid = guard_oid;
  -- Pin the existing body, including its reservation-only decrement exception.
  -- This is an equality checksum, not a cryptographic security boundary.
  if guard.proowner <> (select oid from pg_catalog.pg_roles where rolname = 'postgres')
     or not guard.prosecdef or guard.prokind <> 'f'
     or guard.prorettype <> 'pg_catalog.trigger'::pg_catalog.regtype
     or guard.proconfig is distinct from array['search_path=""']::text[]
     or pg_catalog.md5(guard.prosrc) <> 'b1ac65d9a274ab4c40a6451e78d790cb'
     or exists (
       select 1 from pg_catalog.aclexplode(coalesce(guard.proacl,
         pg_catalog.acldefault('f', guard.proowner))) acl
       where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
     )
     or pg_catalog.has_function_privilege('anon', guard_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', guard_oid, 'EXECUTE') then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_INVENTORY_GUARD_PREREQUISITE';
  end if;

  -- A misplaced canonical trigger is drift, not permission to add another one.
  if exists (select 1 from pg_catalog.pg_trigger
      where tgname = 'evo_store_inventory_guard_archived'
        and tgrelid <> 'public.evo_store_inventory'::pg_catalog.regclass) then
    raise exception using errcode = 'P0001', message = 'EVO_STORE_INVENTORY_GUARD_WIRING';
  end if;
  select * into wiring from pg_catalog.pg_trigger
    where tgrelid = 'public.evo_store_inventory'::pg_catalog.regclass
      and tgname = 'evo_store_inventory_guard_archived';
  if not found then
    create trigger evo_store_inventory_guard_archived
      before insert or update or delete on public.evo_store_inventory
      for each row execute function private.guard_evo_store_archived_product_inventory();
  elsif wiring.tgfoid <> guard_oid or wiring.tgtype <> 31
      or wiring.tgenabled <> 'O' or wiring.tgisinternal
      or wiring.tgqual is not null or wiring.tgnargs <> 0
      or wiring.tgattr <> ''::pg_catalog.int2vector
      or wiring.tgconstraint <> 0
      or wiring.tgoldtable is not null or wiring.tgnewtable is not null then
    -- 31 = ROW | BEFORE | INSERT | DELETE | UPDATE, with no extra events.
    raise exception using errcode = 'P0001', message = 'EVO_STORE_INVENTORY_GUARD_WIRING';
  end if;
end;
$repair$;
