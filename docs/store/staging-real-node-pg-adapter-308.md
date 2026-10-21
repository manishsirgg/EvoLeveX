# PR #308 — Server-only real Node PostgreSQL role-reader adapter

This PR adds a **server-only**, **uninstantiated** staging composition for the locked `pg@8.16.3` driver from PR #307. Its configuration requires explicit host/port/database/user/password and a CA PEM from a trusted server-side bootstrap. It constructs `pg.Client` with `ssl: { rejectUnauthorized: true, ca }`, the bounded timeout parameters from PR #300, and the client connect/query/close lifecycle from PR #301. Queries continue through the fixed parameterized `test_role_reader_296.eligible($1::uuid)` contract and strictly boolean authorization parser.

A narrow local TypeScript declaration is used for the driver rather than adding an unverified `@types/pg` dependency. The application tests only assert the module's server-only and TLS configuration boundaries; they **do not** establish live connection, CA trust, authentication or PostgreSQL permissions. Existing real `pg` disposable integration tests from PR #305 remain the network-level evidence.

**Critical deployment blocker:** `test_role_reader_296.eligible` exists exclusively in disposable test databases, not in production/staging Supabase. This adapter has no endpoint, no environment-variable bootstrap, no secret, no live initialization, and no production role or migration. Before any staging connection is configured, review and deploy a separate restricted private function and LOGIN role in an independently approved migration; validate actual CA and TLS certificate hostname verification in staging, credential rotation, and independent Supabase Auth operator binding. A caller cannot use a database eligibility check as proof of human identity.

No Store worker/correlation permissions, Razorpay Orders POST/capture, or Printful fulfillment are enabled.
