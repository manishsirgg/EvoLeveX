# PR #322 — real restricted node-postgres PostgreSQL session

This adds a **real pg.Client authenticated PostgreSQL session** to the existing disposable Supabase PostgreSQL 15/17 integration matrix. It uses only the compiled-in 127.0.0.1:55432 test target and the test-only `evo_reader_login_315` role from the existing stable private-reader fixture. No externally supplied connection URL or credentials are accepted.

Regression checks: actual PostgreSQL session and current_user/session_user; a parameter-bound SECURITY DEFINER eligibility call (admin succeeds; outsider fails); direct role/order table reads rejected (SQLSTATE 42501); SET ROLE to the function owner rejected; and revocation taking effect on a second call from the **same** connected pg client. The client is closed in a finally block.

The disposable test is deliberately plaintext loopback and does **not** claim TLS trust or hostname validation, which PR #321 tests with a synthetic SSLRequest wire server. Combining both demonstrations is not a live Supabase staging connection test. This change does not install a production migration, configure any server credentials, grant any production privileges, activate an issuer/worker, or enable Razorpay/Printful. Keep draft until the database matrix and application validation pass.
