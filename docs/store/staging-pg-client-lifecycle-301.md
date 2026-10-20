# PR #301 — Staging PostgreSQL client lifecycle

This staging-only adapter composes with the restricted fixed-query transport from PR #300. It accepts a server-owned PostgreSQL client constructor and performs one connect/query/close lifecycle per query. The transport supplies TLS certificate-verification and three-second timeout requirements to the constructor. The adapter closes the client after successful queries, failed queries, and failed connections, and normalizes errors without exposing connection strings, passwords or database error details. Application tests use simulated clients to exercise each path.

## Not a production connection

This PR deliberately **does not** install or instantiate the `pg` package, connect to Supabase, open a live network connection, provision a role or secret, add a route, grant database privileges or enable ticket/payment execution. A future real constructor must be independently reviewed for TLS CA, statement/query cancellation, connection leaks, pool policy, credential rotation and disposable PG15/17 privilege assertions. Timeouts in this version are configuration values supplied to the mock constructor and not evidence of real network enforcement. The target `test_role_reader_296.eligible` remains disposable-only and does not exist as a reviewed production function.

The legacy owner-only Store correlation function must not be granted to a restricted worker. Razorpay Orders POST, capture and Printful fulfillment remain disabled.
