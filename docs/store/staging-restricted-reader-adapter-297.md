# PR #297 — Restricted role-reader application adapter

This staging-only application adapter reconciles the PR #295 parameterized role-lookup interface with the narrower **function-only** PostgreSQL reader from PR #296. It sends only `SELECT test_role_reader_296.eligible($1::uuid) AS eligible` to an injected, server-owned database query callback, using a UUID bound parameter. It accepts exactly one boolean `true` row, otherwise denies access; invalid IDs and connection errors fail closed.

The adapter composes with the existing Supabase Auth `getUser(token)` operator-binding logic. Unit tests verify SQL shape, input validation, conservative results and rejection after live role revocation before a ticket writer is invoked.

**Not deployed:** `test_role_reader_296` is a *disposable test fixture*, not a real production function. The app's adapter remains uninstantiated and there are no database credentials, runtime connection pool, issuer endpoint, worker execution or production grants. Before even staging a live connection, define a reviewed, private function with appropriate role restrictions, explicit server-owned connection requirements and repeat the role matrix in isolated database tests. Do not deploy this test-schema function into production.

The owner-only Store correlation functions, deny-all proof gate and disabled Razorpay/Printful operations are unchanged.
