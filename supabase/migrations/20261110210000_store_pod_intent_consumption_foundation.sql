-- POD signed-intent consumption ledger: immutable, single-use evidence only.
-- NO login/role, grant, API, nonce consumer, payment or fulfilment integration.
-- A future isolated worker must verify Ed25519 proof, expected nonce, customer
-- and all external inputs BEFORE inserting the quote and consumption together.
begin;

-- Composite reference prevents attaching a nonce to another customer's quote
-- or to a different idempotency key, even with elevated worker credentials.
alter table private.evo_store_pod_quote_snapshots
 add constraint evo_store_pod_quote_id_customer_key_unique
 unique(id,customer_id,idempotency_key);

create table private.evo_store_pod_intent_consumptions (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null,
 customer_id uuid not null,
 idempotency_key uuid not null,
 worker_id uuid not null,
 nonce text not null check (nonce ~ '^[a-f0-9]{32,64}$'),
 quote_digest text not null check (quote_digest ~ '^[a-f0-9]{64}$'),
 proof_digest text not null check (proof_digest ~ '^[a-f0-9]{64}$'),
 proof_issued_at timestamptz not null,
 proof_expires_at timestamptz not null,
 consumed_at timestamptz not null default now(),
 constraint evo_store_pod_intent_proof_window check (
  proof_expires_at > proof_issued_at
  and proof_expires_at <= proof_issued_at + interval '60 seconds'
 ),
 constraint evo_store_pod_intent_consumption_window check (
  consumed_at >= proof_issued_at
  and consumed_at < proof_expires_at
 ),
 constraint evo_store_pod_intent_quote_identity_fk
 foreign key(quote_id,customer_id,idempotency_key)
 references private.evo_store_pod_quote_snapshots(id,customer_id,idempotency_key)
 on update restrict on delete restrict,
 constraint evo_store_pod_intent_nonce_once unique(worker_id,nonce),
 constraint evo_store_pod_intent_quote_once unique(quote_id),
 constraint evo_store_pod_intent_customer_key_once unique(customer_id,idempotency_key)
);

create index evo_store_pod_intent_consumptions_customer_idx
 on private.evo_store_pod_intent_consumptions(customer_id,consumed_at);

alter table private.evo_store_pod_intent_consumptions enable row level security;
revoke all on private.evo_store_pod_intent_consumptions
 from public,anon,authenticated,service_role;

-- Immutable evidence retains nonce consumption after quote expiry. No cleanup
-- or reset is permitted; a fresh checkout intent requires a fresh nonce/key.
create function private.guard_evo_store_pod_intent_consumption_immutability()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 raise exception 'STORE_POD_INTENT_CONSUMPTION_IMMUTABLE' using errcode='23514';
end;
$$;
revoke all on function private.guard_evo_store_pod_intent_consumption_immutability()
 from public,anon,authenticated,service_role;

create trigger evo_store_pod_intent_consumption_immutable
 before update or delete on private.evo_store_pod_intent_consumptions
 for each row execute function private.guard_evo_store_pod_intent_consumption_immutability();

-- This statement-level gate checks actual transaction time, not a caller-
-- supplied consumed_at value. Database uniqueness enforces concurrent reuse.
create function private.guard_evo_store_pod_intent_consumption_freshness()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.consumed_at is distinct from statement_timestamp()
    or new.proof_issued_at > statement_timestamp()
    or new.proof_expires_at <= statement_timestamp() then
  raise exception 'STORE_POD_INTENT_CONSUMPTION_STALE' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function private.guard_evo_store_pod_intent_consumption_freshness()
 from public,anon,authenticated,service_role;
create trigger evo_store_pod_intent_consumption_freshness
 before insert on private.evo_store_pod_intent_consumptions
 for each row execute function private.guard_evo_store_pod_intent_consumption_freshness();

comment on table private.evo_store_pod_intent_consumptions is
 'Immutable once-only POD intent ledger. Not authority to charge or fulfil. No grants/policies/consumer; restricted worker must atomically insert quote+nonce after authenticating proof and external source evidence.';
commit;
