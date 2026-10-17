# Store isolated correlation worker — deployment decision gate (PR #265)

**Current status: staging admission contract only. Not deployable infrastructure.**

## Proposed execution boundary

Use a **separate dedicated background worker service** with its own deployment identity, secret manager, restricted network egress, and PostgreSQL login role. Do not run privileged correlation under the public Next.js/Vercel SSR process, Supabase service-role key or an externally callable function.

A future execution request contains only an attempt UUID and a reference to a signed, server-validated operator session. The worker must validate the session using the authoritative Supabase Auth endpoint (not a caller-supplied operator UUID), recheck role eligibility from live data, verify Razorpay Orders GET independently, and reload the attempt immediately before mutation. All worker adapters must be bound at startup, never injectable via public request data.

## Critical database trust problem requiring resolution before any grant

The existing private atomic SQL function reads `auth.uid()`, which in direct PostgreSQL connections is derived from session settings. **Setting `request.jwt.claim.sub` is not authentication.** The eventual database mutation boundary must take an operator identity established cryptographically inside the worker, prove it is still authorized during the transaction, and reject impersonation, revocation, replay, and TOCTOU changes. Simply exposing EXECUTE to a worker login and setting arbitrary GUC values is insufficient.

Before enabling execution, independently review and test the exact worker database role and grants; bind operator identity with a trusted protocol and immutable evidence. Never grant EXECUTE to `anon`, `authenticated`, `service_role`, or a public role.

## Staging prerequisites and rollback

- Obtain a dedicated isolated worker service and secret manager with separate access policies; **do not place database-owner passwords in Vercel or this repository**.
- Create staging-only scoped credentials with rotation and emergency revocation, using reviewed migrations and database role matrix.
- Add durable, non-sensitive audit of admitted, rejected and failed jobs; record reason codes, time, operator and attempt identifiers only after authentication.
- Add rate limiting, bounded retries, atomic execution nonce use and a controlled operator queue. No auto-retry of uncertain external orders.
- Keep `STORE_RESERVATION_BRIDGE_ENABLED=false`, capture disabled, Printful fulfillment disabled.
- Add network and worker-identity tests proving that client traffic cannot submit arbitrary auth adapters, evidence, credentials or SQL.
- Rehearse emergency worker termination, secret rotation, role revocation and recovery on staging.
- Do not use `assertStoreWorkerAdmission` as a security boundary. It only rejects incorrect configuration. It explicitly blocks `environment=production`; production requires a separate reviewed release.

**No runtime worker, external service, database GRANT, production migration, payment order POST, capture or Printful activation is included in PR #265.**
