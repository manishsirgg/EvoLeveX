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
- `008_store_variant_prices.sql`: archived-parent price mutation protection,
  trigger hardening, price constraints, readiness, and RLS preservation.
- `010_store_checkout_foundation.sql`: Store checkout/reservation snapshot schema,
  money/null boundaries, lifecycle, idempotency, indexes, currency-equality FK,
  historical FKs, owner/staff SELECT-only RLS/ACLs, and no inventory effects.
  Phase 2J-B must verify source-address ownership, variant/product correspondence,
  authoritative pricing/subtotal, and database-authored 30-minute expiry. Snapshot
  immutability currently rests on SELECT-only customer/staff grants; privileged
  transactional RPCs will own writes. No reservation RPC exists in Phase 2J-A.
- `database-integration.test.mjs`: local-stack orchestration plus separate
  `psql` sessions for checkout, reservation, attachment, expiry/capture,
  duplicate capture/refund, fulfillment, and Store price/archive locking races.
- `harness.test.mjs`: executable fail-closed and immutable-baseline self-tests
  that do not require Docker.

## Phase 2J-A validation notes

The shared Store currency helper is immutable, strict, SECURITY INVOKER and has
an empty search_path. Authenticated needs EXECUTE for existing staff variant-price
writes; anonymous and PUBLIC have no EXECUTE. Its CHECK dependencies prevent a
plain DROP FUNCTION. A future whitelist change must replace/revalidate dependent
CHECK constraints: CREATE OR REPLACE FUNCTION alone does not recheck stored rows.
Bootstrap creates the helper before its constraints; pg_dump dependency ordering
must also preserve this relationship. The pinned baseline is not regenerated.

The approved address-selection/review/reservation flow requires a complete
shipping snapshot at checkout creation. Phase 2J-B must validate a selected
customer-owned address before copying; nullable address_id is a historical source
reference, allowing saved-address deletion while preserving the required snapshot.
The terminal guard permits active to released/expired/consumed and same-state
operational repair, but prevents any terminal-state change even for service_role.

CI validation: `.github/workflows/database-integration.yml`, job
`disposable-supabase`, pins Supabase CLI 2.48.3, then runs
`npm run test:database:harness` and `npm run test:database:integration`.
The integration runner applies the actual Phase 2J-A migration and runs
`010_store_checkout_foundation.sql` along with every other database suite.
