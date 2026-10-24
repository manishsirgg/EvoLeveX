# PR #319 — TLS failure handling regression tests (simulated failures)

Adds staging-only tests injecting the error codes SELF_SIGNED_CERT_IN_CHAIN, ERR_TLS_CERT_ALTNAME_INVALID, CERT_HAS_EXPIRED, ECONNREFUSED and ETIMEDOUT at the PostgreSQL client connect boundary.

Each assertion proves that a failed connection prevents a role lookup or query, attempts to close its client, and emits only the stable fail-closed error STORE_RESTRICTED_ROLE_READER_UNAVAILABLE without database credentials or raw TLS error content. Existing TLS rejectUnauthorized and connection-timeout settings remain required, as does the fixed query allowlist.

**Coverage limit:** These are deterministic simulated client failures, not real TLS handshakes, certificate-chain verification or hostname/SAN validation. A later integration test with a local TLS PostgreSQL-compatible server and synthetic certificates is still necessary before real staging credentials are permitted. No live database connection, secret injection, Supabase migration, privileged SQL grant, payment initiation/capture or Printful fulfillment.
