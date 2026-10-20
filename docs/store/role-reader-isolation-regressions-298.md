# PR #298 — Staging role-reader isolation regressions

Extends the disposable PostgreSQL 15/17 integration suite for the function-only role-reader LOGIN from PR #296. In addition to existing live admin-role revocation checks, tests require that the dedicated reader cannot:

- `SET ROLE postgres` or `SET ROLE authenticated`;
- create a table or function in `public`;
- read private nonce or provider correlation audit tables;
- read the `public.payments` table.

The fixture also sets an impersonated `request.jwt.claim.sub` and proves the eligibility function still evaluates its *explicit UUID argument*, not the session's asserted user ID.

All privileges under test are **disposable**. This PR does **not** create the deployable function, a real read-only connection, server credentials or a production migration. The application adapter still points at the test-only `test_role_reader_296.eligible` contract. A connection design is not validated merely by denying these actions, and the reader function's SECURITY DEFINER owner remains a separate security-review concern.

Razorpay Orders POST, payment capture, real worker execution and Printful fulfillment remain disabled.
