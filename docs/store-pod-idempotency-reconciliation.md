# POD quote idempotency replay inspection — PR #378

This PR adds a standalone full-evidence fingerprint comparator and an isolated read-only PostgreSQL inspection adapter. It does **not** create a customer checkout route, payment order, Printful order, database migration, role, grant, RLS policy or quote. Existing product publication and POD payment/fulfilment locks remain unchanged.

A future independently authenticated worker may inspect an existing quote by its authenticated customer ID and request idempotency key, using its dedicated PostgreSQL session. Both `current_user` and `session_user` must equal `evo_store_pod_quote_writer`. No application or service-role fallback is permitted. The inspector reads the private quote header and its lines and does not mutate either.

A canonical SHA-256 digest compares the full quote intent: customer, idempotency key, Printful store identity, currency, destination digest, exact decimal item prices and quantities, synchronized/catalog identifiers, selected shipping option, quote observation and expiry, and tax/shipping/subtotal. Lines are sorted by variant ID, so unrelated line order does not cause false conflicts.

The result is one of `ABSENT`, `MATCH`, `CONFLICT` or `UNAVAILABLE`. Expired or invalidated quotes are never reused. A matching stored quote is evidence of an equivalent historical intent, **not** permission to charge, publish or fulfil.

**Critical concurrency limitation:** `ABSENT` is only advisory. It cannot authorize an insertion because a concurrent transaction might insert first. The unique `(customer_id,idempotency_key)` database constraint and transaction-level conflict handling remain authoritative. A future writer must handle unique violations, serialization retries and uncertain commit outcomes by re-reading and comparing the complete committed evidence, rather than issuing a fresh payment or order attempt.

The digest is not a signature and does not authenticate source or tax law. Existing trusted-input verification, live provider request verification, tax authority proof, production approval, dedicated role provisioning and end-to-end financial reconciliation are still required before enabling POD checkout.
