# PR #296 — Disposable minimum-privilege administrator-role reader

The disposable PostgreSQL 15/17 real Store integration suite now creates a dedicated LOGIN named evo_store_role_reader_296 with no inherited roles, superuser capability, role creation or database creation privileges. It receives only USAGE on a test schema and EXECUTE on a single SECURITY DEFINER boolean eligibility function that checks **actual** public.user_roles joined to public.roles.

The test confirms: admin=true, editor=false, revocation immediately flips eligibility false and restoration flips it true; direct SELECT on public.user_roles, public.roles and private.evo_store_provider_order_attempts fails; UPDATE of role assignments fails; and invocation of the private owner-only Store correlation function fails.

**Security qualification:** This is a test-schema function facade rather than a direct least-privilege table-SELECT client for the parameterized SQL from PR #295. It does not connect production credentials to the application adapter. The SECURITY DEFINER function is an isolated test construct and must not be deployed into public application schemas without a separate privilege/security review.

No production migration, database grants, connection secrets, endpoint, ticket issuer, payment capture or Printful fulfillment.
