# PR #317 — Privileged-function EXECUTE inventory and SQL allowlist

Disposable PostgreSQL 15/17 integration test inventories **all routines of pg_proc in the private schema**, checking that the restricted prototype LOGIN `evo_reader_login_315` has no executable function except its intended boolean eligibility reader. This catches grants inherited via PUBLIC as well as explicit privileges, including previously unlisted Store functions. A failing inventory is a security signal to investigate, not permission to grant the LOGIN new rights.

An application transport test rejects alternate private-function calls, raw payment/user role reads, appended statements and malformed parameter counts *before* opening a PG connection. Only the existing hard-coded `test_stage_reader_309.eligible($1::uuid)` SQL is accepted at this stage.

**Safety boundary:** This PR does not grant/revoke live database rights, connect to Supabase, modify the future private reader contract, change PostgreSQL production migrations or enable order/payment/fulfillment execution. The inventory is intentionally strict and may reveal pre-existing PUBLIC privileges in the disposable fixture: any CI failure must be investigated rather than relaxing the check without review.
