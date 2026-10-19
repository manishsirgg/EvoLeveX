# PR #285 — Real Store role and attempt checks in disposable ticket fixture

This augments the existing PostgreSQL 15/17 **disposable** operator-gate integration suite. It creates an owner-only test-schema ticket-consumer function using SHA-256 digests of 256-bit tickets and checks **actual** `public.user_roles` and `public.roles` for admin/super_admin membership and the **actual** `private.evo_store_provider_order_attempts` table for the matching `reconciliation_required` state. It locks the ticket, role membership and attempt rows, and records single-use consumption.

It exercises mismatched actors, mismatched attempts, replay, and administrator role revocation. The test temporarily revokes a super-admin role and restores the fixture for subsequent tests. It asserts no payment records were created.

**Security limitation:** the test consumer explicitly accepts only the disposable database owner `postgres`, **not a restricted worker principal**; tickets are provisioned directly by test setup rather than a trusted authenticated issuer. This fixture proves the real-schema checks but is **not an executable staging or production authorization protocol**. Before considering a DB grant, combine independently authenticated issuer and restricted worker identities with live authorization, provider evidence, authenticated operator binding, real attempt locking and nonce consumption in one audited transaction.

No production SQL migration or privileges; owner-only Store executor and always-false proof gate unchanged. Razorpay payment creation/capture and Printful fulfillment stay disabled.
