# PR #312 — Align staging-only administrator reader contract

Changes the fixed SQL of the existing staging-only Store administrator role lookup from the obsolete disposable `test_role_reader_296.eligible($1::uuid)` function to `test_stage_reader_309.eligible($1::uuid)`. The latter is exercised against real Store roles in disposable PostgreSQL 15 and 17 under separate NOLOGIN function-owner and restricted LOGIN roles, with scoped RLS SELECT policies. The application's UUID binding, fail-closed handling, TLS configuration contract and query allowlist continue to use the same exported fixed SQL constant.

Application tests assert the new function name and parameter binding. The disposable database integration suite asserts that the application source expects the 309 function and exercises that function through a real restricted node-postgres session.

**Deployment boundary:** `test_stage_reader_309` is still a **test-only** SQL fixture. This PR does not provision it in live staging/production Supabase, change production privileges, create credentials or CA configuration, or instantiate the adapter in any API route. In particular, simply aligning a test function name does not authenticate operators or make the function deployable. The real deployed function needs a separate migration/security review, a private stable function name, least-privilege role and RLS policies, and actual TLS trust-chain verification.

Payment preflight/worker execution remain disconnected. The existing privileged correlation function's spoofable `auth.uid()` remains a hard security blocker. Razorpay Orders POST, payment capture and Printful fulfillment remain disabled.
