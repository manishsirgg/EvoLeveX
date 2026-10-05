# Disposable database integration tests

This directory is the test-only Stage 3F-P1-003 harness. The Production-effective
`public`/`private` schema snapshot lives only at
`supabase/migrations/00000000000000_effective_schema.sql` below this directory.
It is deliberately outside the deployable root `supabase/migrations` chain.

## Safety boundary

Run the suite with:

```sh
npm run test:database:integration
```

The runner starts the Supabase CLI project whose fixed ID is
`evolevex-p1-003`, and connects only to
`postgresql://postgres:postgres@127.0.0.1:55432/postgres`. It does not read
`DATABASE_URL`, `SUPABASE_DB_URL`, `PG*`, a linked project, or a project
reference supplied by the caller. Both Node and SQL guards verify the fixed
loopback endpoint, port, database, owner, Supabase roles, and `auth.users`
before the reset. Node proves the fixed endpoint while the SQL guard independently
checks the database, owner, project marker, Supabase roles, and `auth.users`. A
validation failure occurs before destructive SQL.

The baseline SHA-256 is pinned in `helpers/baseline.mjs`. PostgreSQL versions
before 17 receive an in-memory stream with only the unsupported `MAINTAIN` ACL
token removed. That stream is sent directly to `psql`; no derived schema file
is written. The baseline itself must remain byte-identical.

All Razorpay-looking identifiers in fixtures contain `SYNTHETIC`. The harness
has no HTTP client, Razorpay SDK, API key, webhook key, or remote Supabase URL.

## Requirements

- Docker Desktop/Engine
- Supabase CLI 2.48.3 (the CI-pinned version)
- `psql`
- Node.js 20+

The ordinary `npm test` command does not start Docker. The database suite is a
separate opt-in command and tears down its local Supabase project without a
backup after completion.

## Coverage

- `001_catalog.sql`: pgTAP catalog, signature, security, constraint, index,
  trigger, and RLS assertions.
- `002_behavior.sql`: deterministic identities, RLS/ACL boundaries, checkout,
  readiness, reservation, attachment, and expiry behavior.
- `003_lifecycle.sql`: confirmation, fulfillment, capture, webhook replay,
  partial/full refund, conflict, and entitlement revocation behavior.
- `004_store_catalog.sql`: Store publication readiness, normalized variants and
  prices, private image metadata, RLS, compatibility, and staff boundaries.
- `005_store_catalog_management.sql`: staff readiness inspection, atomic audited
  inventory operations, locked inventory privileges, and public availability.
- `006_store_product_images.sql`: private image storage, primary-image transitions,
  archived-parent protection, and image readiness behavior.
- `007_store_product_variants.sql`: archived-parent variant mutation protection,
  trigger hardening, normalization, uniqueness, readiness, and RLS preservation.
- `database-integration.test.mjs`: local-stack orchestration plus separate
  `psql` sessions for checkout, reservation, attachment, expiry/capture,
  duplicate capture/refund, and fulfillment races.
- `harness.test.mjs`: executable fail-closed and immutable-baseline self-tests
  that do not require Docker.
