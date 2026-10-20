# PR #299 — Staging role-reader contract and connection review

This PR adds a **disposable-only** proposed function contract `test_stage_reader_299.eligible(uuid)` that checks real Store administrator membership through `public.user_roles` joined to `public.roles`. Its function body uses a locked-down empty search path, returns a boolean only, and initially revokes function execution from `PUBLIC`, `anon`, `authenticated`, and `service_role`. The test asserts those three application roles are denied and authenticated has no execute privilege.

**No deployable role or credential is created.** The `test_stage_reader_299` name is purposely a test schema; do not point app connections to this fixture. Production needs a separately reviewed private-schema contract and safe migration before any runtime is connected.

Required independent security-review gates before staging credentials or migrations:

1. Provision dedicated LOGIN with `NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS`; independently verify LOGIN, schema USAGE and function EXECUTE grants, inherited membership, default function ACLs, and all direct table/data grants.
2. Restrict network access, use TLS certificate validation, isolated server-only credentials, secret rotation, connection limits and safe pooling; never use a database-owner or service-role key for routine eligibility queries.
3. Ensure the SECURITY DEFINER function's owner has only the necessary role-table access, and review whether the owner can alter privilege-sensitive schema objects. No dynamic SQL or untrusted search path.
4. Implement and independently test a real node-postgres read-only connection adapter with bound UUID parameters, fixed SQL shape, bounded latency and fail-closed error handling.
5. Require Supabase Auth `getUser(token)` to authenticate the human **independently**; membership lookup is authorization, not identity proof.
6. Revalidate privileges on both PostgreSQL 15 and 17 against actual Store tables, role revocation, spoofed claims, pooling and replay. Keep the ticket writer and payment executor completely disconnected.
7. Separately resolve issuer impersonation and the production correlation function's spoofable `auth.uid()` session claim before considering worker execution.

This PR does **not** deploy a private function, grant database permissions in production, create credentials, activate ticket issuance, call Razorpay Orders POST/capture or enable Printful fulfillment.
