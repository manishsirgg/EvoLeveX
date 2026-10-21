# PR #303 — Node.js pg driver against disposable Store reader

Adds a real Node.js `pg` client to the existing disposable PostgreSQL 15/17 Store authorization fixture. CI installs pinned `pg@8.16.3` **only for the integration job**, with `--no-save --package-lock=false --ignore-scripts` after `npm ci`. The application and production lockfile are unchanged.

The integration connects under the already restricted disposable `evo_store_role_reader_296` LOGIN. It verifies `current_user` and `session_user`, executes administrator and editor eligibility through PostgreSQL-bound UUID parameters, rejects payment table SELECT, enforces a live 250ms database statement timeout, closes its client, and demonstrates reconnect and clean closure.

**Limits:** CI's ephemeral driver install is not equivalent to a reviewed, reproducible application lockfile. This integration is local PostgreSQL loopback without TLS; it does not test TLS certificate chain, Supabase cloud connectivity, production credential handling or deployed staging role/function. Do not add this client to a production route, issue tickets or enable payments based on the result. A future dependency and TLS review must provide a proper `package-lock.json` update before runtime use.

No production database migration, worker SQL grants, Razorpay Orders POST/payment capture or Printful fulfillment.
