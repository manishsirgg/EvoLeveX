# PR #321 — Real node-postgres SSLRequest and TLS verification in loopback

The application test starts an ephemeral local TCP listener implementing PostgreSQL's 8-byte SSLRequest negotiation and sends the `S` response. The listener upgrades the socket to genuine server-side Node TLS using a synthetic certificate and key generated at test execution. An actual `pg.Client` is used with `ssl.rejectUnauthorized=true`, injected CA material, and an explicit servername.

Expected tests: (1) matching CA/hostname completes the TLS handshake (but the deliberately incomplete PostgreSQL server **does not authenticate or execute SQL**); (2) a foreign CA is rejected; (3) a mismatched DNS hostname is rejected. Test listener, sockets and synthetic secrets are discarded.

This validates Node `pg` SSL negotiation and certificate rejection but **not** a PostgreSQL session, the restricted database role, Supabase connectivity, operational hostname/CA rotation or a deployment-ready credential bootstrap. No production migration, connection to live services, elevated privileges, Store executor, Razorpay or Printful activation.
