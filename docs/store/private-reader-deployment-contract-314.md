# PR #314 — Proposed private Store eligibility reader deployment contract (NOT deployed)

**Proposed stable interface:** `private.evo_store_operator_eligible_for_reconciliation(p_operator uuid) RETURNS boolean`. This is an independent server-side *authorization* lookup, not proof of caller identity, payment authorization or an RPC exposed to browser/API clients. The name is reserved in design only: do not create or execute it against production in this PR.

## Minimum separation and access

- Owner: `evo_store_role_reader_owner` (NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS). SELECT only on `public.roles`/`public.user_roles`; dedicated SELECT RLS policies only for this owner.
- Caller: `evo_store_role_reader_login` (LOGIN with isolated rotated secret, NOINHERIT and no elevated attributes), schema USAGE and EXECUTE on exactly one boolean function; no table SELECT, schema CREATE, role membership in owner, private payment access or correlation execution.
- SQL function: SECURITY DEFINER, SET search_path='', fully qualified references, no dynamic SQL, no mutable JWT claims; return only admin/super_admin membership for explicitly provided UUID.
- In a reviewed migration set ACLs **before** ownership transfer (PG15/17). Confirm no residual public/default EXECUTE, additional grants or role inheritance afterward. Neither test schema names nor disposable passwords may appear in deployed configuration.

## Required deployment gates

1. Independently review actual Supabase target schema, role ownership, policies, default privileges, functions, RLS and role membership. Validate privilege changes on a **separate, expressly approved staging instance**; no production migration in this PR.
2. Verify the proposed `private` schema is not PostgREST-exposed. Never grant EXECUTE to anon, authenticated, service_role, or broad PUBLIC.
3. Supply an independent, trusted server-side Supabase Auth getUser identity before checking membership; an arbitrary UUID boolean lookup alone cannot authorize work.
4. Use server-only credentials, managed secret rotation, restricted network routes and pinned CA bundle with hostname-aware TLS verification. Test actual certificate failures and connection limits; do not use service_role/owner secrets as a reader login.
5. Ensure the app fixed SQL string is migrated and reviewed atomically with the function and privilege deployment. The current adapter still points at a disposable function `test_stage_reader_309.eligible`; do not activate it.
6. Preserve the existing owner-only correlation executor deny gate; it uses spoofable session identity and must NOT be granted to this reader or worker. Ticket issuance, Razorpay Orders POST/capture and Printful fulfillment remain disabled.
7. Implement roll-forward and rollback, role revocation checks, audit/logging and safe secret disposal; do not automatically deploy on merge.

This document is a design review target, **not a deployable migration, credential provisioning instruction or permission to activate payment flows**.
