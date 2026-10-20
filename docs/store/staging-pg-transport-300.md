# PR #300 — Isolated staging PostgreSQL role-reader transport contract

Adds a testable **staging-only transport contract** for the restricted boolean role-reader adapter from PR #297. The injected connection factory is required to accept TLS certificate verification, three-second connection/query/statement timeouts, and a dedicated application name. The transport rejects every SQL statement except the fixed function-only query `SELECT test_role_reader_296.eligible($1::uuid) AS eligible`, passes the UUID as a bind parameter, and fails closed on connection or query errors.

**No real database transport is instantiated.** The connection factory is injected and tested with mocks. The application does not currently depend on `pg`, and PR #300 does not add `pg` or `@types/pg`, configure credentials, verify TLS to an actual Supabase endpoint, implement a pooling lifecycle or an actual DB role. The name `test_role_reader_296` is still an isolated PostgreSQL test fixture and is not available in production.

Before a live staging connection is considered, a separate reviewed DB role/function and TLS/root CA policy, secret isolation and rotation, connection/pool closure handling, credential scope, and live PG15/17 privilege tests are mandatory. The existing owner-only payment correlation function uses mutable `auth.uid()` session claims and must never be granted to the worker based on this work.

No production migration, privilege grant, live ticket issuer, Razorpay order creation/capture or Printful fulfillment.
