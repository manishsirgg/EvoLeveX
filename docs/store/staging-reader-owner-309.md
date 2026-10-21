# PR #309 — Disposable restricted function ownership model

Extends the real Store database integration suite with a **test-only** staging-style administrator eligibility function owned by a dedicated `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOBYPASSRLS` role. The definer has explicit SELECT privileges on real `public.user_roles` and `public.roles`, while a separate `LOGIN` reader receives only USAGE on a test schema and EXECUTE on a boolean function. No app role receives access. The executable SQL has an empty search_path and no dynamic SQL.

PG15/PG17 tests exercise eligibility, membership revocation/restoration, denied raw role and payment-table reads, denied private Store attempt access, and denied SET ROLE to the function owner. They also check that the owner cannot log in.

**Not ready for live staging:** ownership privileges must still be reviewed against row-level security and the full Supabase schema. The function exists only in disposable `test_stage_reader_309`; it is not the app adapter's `test_role_reader_296` and is not a production migration. No credentials, CA/TLS, pool, HTTP endpoint, trusted operator issuer or worker are deployed. Do not change production DB grants or provide the privileged correlation executor to this reader.

Razorpay Orders POST, capture and Printful fulfillment remain disabled.
