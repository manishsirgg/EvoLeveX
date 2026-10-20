# PR #302 — Real disposable PostgreSQL client-session regression

This incremental PR exercises **real `psql` PostgreSQL connections** to the existing disposable Supabase PostgreSQL 15/17 fixtures, using the restricted role-reader LOGIN. It verifies the authenticated `current_user` and `session_user`, applies a live PostgreSQL `statement_timeout=250` and `PGCONNECT_TIMEOUT=3`, checks the expected read-only eligibility query, confirms an intentionally slow query is cancelled, and denies direct payment-table reads. Each child `psql` process opens and closes its own real session.

**Precisely scoped:** `psql` is a real PostgreSQL client but **not** the future Node.js `pg` driver or a reusable connection pool. The disposable PostgreSQL endpoint is on 127.0.0.1 and TLS certificate verification is **not** tested here. This does not construct the app-side driver, provision a deployable function/role, create production credentials or activate a live Store issuer/worker. Installing or validating Node `pg` must be completed in a future PR with a trusted package-lock update and actual client lifecycle tests; do not infer those guarantees from this test. The existing mock lifecycle tests from PR #301 remain relevant but are not proof of a real Node driver.

No production migration, payment/correlation SQL grants, Razorpay Orders POST/capture, or Printful fulfillment.
