# EvoLeveX Store: restricted provider correlation architecture (PR #259)

**Status: design only. Not an authorization to enable production payment or fulfillment.**

## Trust boundaries

1. **Browser/operator session:** Use Supabase `auth.getUser()` on the server; require `admin` or `super_admin` using the installed eligibility gate. Browser input may provide only an attempt UUID; never provider order ID, amount, receipt or currency as trusted values.
2. **Read-only reconciliation:** Load the uncertain attempt through the existing operator-JWT audited RPC. Discover by trusted receipt using Razorpay Orders GET; reject incomplete or ambiguous pagination. Independently GET the unique candidate ID, verify receipt, exact subunit amount and currency; re-read and re-authorize after network calls.
3. **Dedicated executor (not built):** Separate server-only execution process holding a narrow database credential, isolated from customer routes and general Next.js runtime. Operator identity must be derived from a validated session by the worker; never accept free-form operator UUID from a caller. Use an allowlisted job, time-limited request nonce, single-attempt identity and explicit evidence freshness limit. Rate limit and create a durable job-level audit trail for rejected as well as successful attempts.
4. **Database call:** Invoke `private.record_evo_store_verified_provider_correlation` only from a carefully scoped database role with specific EXECUTE privilege and no table access. **Never grant EXECUTE to `authenticated`, `anon` or Supabase `service_role`.** The function currently reads `auth.uid()`; simply using a new privileged connection without validated JWT claims will fail. Future implementation must safely bind claims to a verified operator in the same transaction without permitting session-variable spoofing from external callers.
5. **Completion:** Correlation records a provider order association, nothing more. `payment_ready=false` throughout. Separate captured-payment verification, paid order transition and Printful authorization need independent reviews.

## Required security decisions before implementation

- Select the isolated runtime (dedicated background worker or server process) and secret distribution, rotation and access controls.
- Define worker-to-DB connection pathway and one restricted PostgreSQL login role, only after verifying permissions and transaction security.
- Decide how session claims are signed/verified; **PostgreSQL GUCs like `request.jwt.claim.sub` are not authentication**. Do not accept a user ID from JSON and set it as an auth claim.
- Reconcile revoked administrator roles at the moment of mutation and prove concurrent revocation, contradictory evidence and repeated attempts are fail-closed.
- Prove the audit table records operator ID, attempt ID, verified provider ID, and outcome. Rejected attempts require a separate durable log because SQL exceptions roll back transaction-local audit inserts.
- Verify provider pagination completeness under mutations and implement a bounded review/lock state if evidence cannot be proven complete.
- Define network timeout, retry, backoff and replay protection policies; prohibit duplicate provider-order POST dispatch.
- Keep Store bridge, capture and Printful flags disabled through controlled testing.

## Acceptance checks

- Disposable PG15/PG17 role matrix, attempt locks, replay/idempotency, conflicting correlations and revocation.
- Credential misuse tests: anonymous/user JWT/service role cannot directly invoke the restricted function or read private tables.
- Worker protocol tests: caller-supplied evidence, operator ID, stale proof, changed amount/receipt and unsupported currency all rejected.
- Full application typecheck, tests, Next.js build; safe logs (no keys, full user tokens or payment secrets).
- Production deploy requires a **separate approval**, verified schema migration, operator runbook, emergency disable switch and rollback plan.

## Current execution status

The PR #258 TypeScript `RestrictedCorrelationExecutor` is a contract, **not an implemented privileged adapter**. The production SQL wrapper is owner-only. This PR deliberately adds no job consumer, privileged credential, DB GRANT, HTTP endpoint or payment operation.
