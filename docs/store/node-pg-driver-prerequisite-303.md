# PR #303 — Node PostgreSQL driver configuration prerequisite

This PR contributes a staging-only immutable configuration contract for a future Node `pg` client, requiring a server-owned PostgreSQL connection string, explicit CA certificate, TLS peer verification, and bounded connect/query/statement timeouts. It rejects connection-string SSL override options to avoid weakening trusted configuration. Tests use synthetic credentials and do not connect to the network.

**Not a driver installation:** `pg` and `@types/pg` are not installed and the package lock is deliberately unchanged because npm registry access was unavailable during authoring. No runtime imports the `pg` driver and no real Node PostgreSQL connection, TLS handshake, database user, secret or pool is established. The contract does not validate that a CA bundle is authentic; it only requires the expected PEM structure.

The next step must use a trusted environment with registry access to run `npm install pg` and `npm install -D @types/pg`, committing the npm-generated package-lock, then exercise the actual driver against **disposable PG15/17** with server-owned restricted identity and verified TLS.

No production migration, grants, issuer, executor, Razorpay Orders POST/capture or Printful fulfillment.
