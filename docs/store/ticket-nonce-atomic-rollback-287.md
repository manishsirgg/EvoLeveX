# PR #287 — Disposable atomic ticket, nonce and correlation experiment

This test-only PostgreSQL 15/17 integration fixture creates an authenticated, unprivileged worker LOGIN and an owner-defined SECURITY DEFINER function that validates a SHA-256-digested 256-bit authorization ticket, locks its synthetic operator eligibility and attempt state, marks the ticket consumed, inserts a unique nonce and records a **synthetic** correlation in one database transaction.

It asserts that a constraint failure in the correlation insert rolls back BOTH ticket consumption and nonce insertion, that successful calls commit all three effects, and that ticket replay is rejected. The test-only worker cannot directly read the protected records.

**Critical limitation:** all roles, attempts, tickets, nonces and correlations are synthetic test-schema objects. This does **not** call the real `private.execute_evo_store_correlation_atomically`, does not verify Razorpay evidence or integrate a live independent ticket issuer, and does not remove the existing `auth.uid()` caveat on the production owner-only function. The tests are a database transaction proof of concept, **not authorization to grant worker EXECUTE**.

No production SQL migrations, DB credentials, role grants, payment initiation/capture or Printful fulfillment.
