# PR #313 — Disposable private-schema Store reader prototype

Adds an independently named, **disposable-only** function `test_store_private_313.is_operator_eligible(uuid)` using a restricted SQL SECURITY DEFINER, empty search_path, role-membership lookup and scoped RLS SELECT policies. Its owner is a distinct NOLOGIN database role with limited SELECT access, while its dedicated LOGIN caller receives schema USAGE and function EXECUTE only.

The PG15/17 integration tests verify admin versus editor, immediate revocation and restoration, direct role/payment SELECT denial, failed owner-role switching, and denied EXECUTE for anon/authenticated/service_role.

**No live Supabase deployment:** the schema name deliberately begins with `test_`, the password is disposable CI-only, and no production migration or secret is introduced. The current application lookup still references `test_stage_reader_309.eligible`; the two interfaces are intentionally not switched by this PR. This prototype demonstrates a possible dedicated private reader interface, *not* approval to provision it. Further review is required for Supabase role ownership, a stable non-test schema/function name, default privileges, credential rotation, TLS chain and hostname validation, RLS safety, pooling and revocation. No live Store ticket issuer or payment executor is connected.

Razorpay Orders POST/capture and Printful fulfillment remain disabled.
