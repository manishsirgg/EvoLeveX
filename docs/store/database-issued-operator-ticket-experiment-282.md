# PR #282 — disposable database-issued authorization ticket experiment

A restricted PostgreSQL LOGIN principal can authenticate its connection independently of mutable JWT claims. This integration fixture tests one possible **database-mediated actor handoff**: a separately privileged issuer records a high-entropy single-use ticket binding operator ID, Store attempt ID and expiration. A restricted worker may only *consume* the ticket via a SECURITY DEFINER function that checks session_user, locks the ticket, rechecks role eligibility under the same transaction, and records consumption. It cannot mint or read tickets.

The fixture uses synthetic roles, a synthetic role table, and a random UUID ticket issued by the test setup. It proves only the *shape* of the protocol in disposable PostgreSQL 15/17, not production security. All tables/functions are in a test-only schema recreated on the isolated local database. No production migration or GRANT.

**Blockers before deploying:** independently authenticated trusted ticket issuer; durable issuer authorization/audit; binding issuance to the verified operator session and independent provider evidence; protection against stolen bearer tickets; current Supabase admin role-table checks under lock; transaction-level attempt-state recheck, nonce replay, competing workers and revocation; potential session_user/pooler behavior; short ticket TTL and key lifecycle; no privilege bypass or open SQL access. Especially, a worker with a compromised ticket must never be able to mint another operator's ticket.

The production `private.can_execute_evo_store_signed_correlation` still returns false. `private.execute_evo_store_correlation_atomically` stays owner-only. Payment initiation, capture and Printful fulfillment remain disabled.
