# PR #285 — Real-schema authorization preflight regression

This draft PR adds disposable PostgreSQL integration assertions using the **real** `public.roles` / `public.user_roles` membership tables and the **real** `private.evo_store_provider_order_attempts` state. It verifies admin and super-admin eligibility, editor denial, an actual `reconciliation_required` attempt, and role revocation/restoration without changing payment records.

These assertions are **not a ticket issuance or consumption implementation**. A more ambitious test-only SECURITY DEFINER fixture was withdrawn from this draft because its generated JavaScript template broke CI parsing. Separate PostgreSQL issuer/consumer, 256-bit digest ticket, replay and TTL tests continue to live in PR #284's merged disposable suite.

There are no production migrations, role grants, worker activation, Razorpay payment operations or Printful actions. Before production execution, trusted issuer identity, locked role/attempt checks and operator-to-worker binding must be integrated atomically with the existing nonce and correlation protocol.
