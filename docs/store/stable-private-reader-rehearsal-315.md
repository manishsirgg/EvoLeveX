# PR #315 — stable-name private reader in disposable PostgreSQL only

Rehearses the proposed `private.evo_store_operator_eligible_for_reconciliation(uuid)` contract in isolated PG15/17 databases. Fixture: `tests/database/fixtures/store-stable-private-reader-315.sql`. It is NOT a Supabase migration. It installs a dedicated NOLOGIN SECURITY DEFINER owner, a separate login with function-only EXECUTE, limited RLS SELECT access to role tables, and no role inheritance.

Integration assertions cover admin/super_admin eligibility, editor rejection, role revocation and restoration, denied direct reads of role/payment tables, denied SET ROLE to the owner and no EXECUTE for anon/authenticated/service_role.

Cautions: the function accepts an arbitrary UUID, so caller identity must first be verified independently by server-side Supabase Auth getUser. This fixture contains a disposable password and MUST NEVER be run on staging or production. No deployable credentials, TLS CA verification, migration, application query switch, ticket issuer or payment/fulfillment activation. Real deployment still requires independent schema/ACL/RLS security review, function ownership and default-privilege audit, TLS hostname tests, credentials and rollback design.
