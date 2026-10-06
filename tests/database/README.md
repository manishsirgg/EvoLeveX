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

## Phase 2J-B transactional reservation contract

Migration: `20261006010000_evo_store_transactional_inventory_reservations.sql`.
The public RPC signatures are:

```sql
public.create_evo_store_checkout(
  p_items jsonb, p_currency text, p_idempotency_key uuid, p_address_id uuid
) returns jsonb
public.release_evo_store_checkout(p_checkout_id uuid) returns jsonb
```

Both are SECURITY DEFINER with `search_path = ''`, fully qualified database
objects and identity from `auth.uid()`. PUBLIC, anon and service_role execution
is explicitly revoked; authenticated receives EXECUTE. Private helpers have no
PUBLIC/anon/authenticated/service_role execution grant. Existing table RLS and
ACLs remain intact; authenticated still cannot directly mutate snapshots,
inventory or movements. These RPCs never call the staff inspection RPC.

Creation accepts only `variant_id` and `quantity` per object, rejects extra keys,
and requires a nonempty array of at most 50 unique UUIDs with numeric integral
quantities 1–10. Currency is trimmed/uppercased and validated through the Phase
2J-A canonical helper. There is no FX, fallback price, client price, client user
identity or client shipping snapshot. A saved address is required, checked for
ownership and complete shipping fields, read under SHARE lock and copied.

The fingerprint is the canonical JSONB object's textual representation containing
normalized currency, selected address UUID and UUID-sorted variant/quantity pairs.
It stores the canonical request itself, avoiding hash collisions in request
comparison. A transaction advisory lock on
`hashtextextended('evo_store_checkout:user:' || auth.uid()::text, 0)` serializes
**all** keys for one customer, which also protects the one-active-checkout rule.
Advisory hash collisions cause only additional contention. Both create and release
use this boundary before checkout header locks. Same-key equal requests replay
without catalog/address revalidation, new items, reservation increments, repricing
or expiry extension, including after source-address deletion or product archival.
Different fingerprints conflict. A new key while a valid active checkout exists
fails with ACTIVE_EXISTS. Same-key elapsed replay remains a replay; only a new
request performs the targeted lazy expiry.

After lifecycle locks, all affected product UUIDs are locked in ascending order,
then inventory variant UUIDs in ascending order. Lazy expiry locks the combined
old/new set before either decrement or increment, avoiding reversed lock order
across crossed old/new requests. Current owners and historical snapshot parents
are included; owner changes while acquiring locks cause STATE_CONFLICT. Creation
re-reads the published physical product, active variant, weight, inventory and
active selected-currency price while locks are held. It uses the private canonical
product-readiness predicate for active category, image/primary image and the
remaining publication invariants. Selected price is independently required to be
positive, finite and JPY-integral. Missing/inactive selected currency never falls
back. Quantity availability is checked against on-hand minus reserved.

All lines are validated before inserting snapshots. Numeric line totals and header
subtotal are database-authored; totals exceeding the existing numeric(14,2) header
capacity fail safely. Product/variant names, SKU and **dedicated variant size/color
columns** are snapshotted. Discount is zero, shipping/tax/grand totals remain NULL,
and expiry is `transaction_timestamp() + interval '30 minutes'`. Header, items
and reservation increments are atomic. No inventory movement is inserted and no
on-hand field is changed.

Release checks ownership without distinguishing nonexistent and foreign IDs.
Released/expired states are successful terminal replays; consumed returns
ALREADY_CONSUMED without a decrement. Active release locks the parent/inventory
set, checks each aggregate can cover its item quantity, decrements exactly once
and writes the database-authored released timestamp. Lazy expiry follows the same
private terminal helper and writes expired status/time before the new reservation.
Any subsequent new-checkout failure rolls the old release back too. Missing or
insufficient accounting raises RECONCILIATION_REQUIRED; nothing is clamped.

The previous archived inventory guard needed a narrow replacement: UPDATE may
reduce `quantity_reserved` when every other field except `updated_at` is unchanged.
It still takes ordered product locks. On-hand/threshold/ownership changes,
reservation increments, INSERT and DELETE under archived parents remain rejected.
This permits releasing existing archived-product holds without bypass flags,
trigger disabling, new customer DML grants or physical inventory movements.
Privileged maintenance may also make this narrowly defined decrement; customer
DML is still denied. Existing Phase 2G guard regression tests remain unchanged.

The returned JSON allowlist contains `id`, `status`, `currency`, `subtotal`,
`discount_total`, nullable `shipping_total`/`tax_total`/`grand_total`, `created_at`,
`expires_at`, terminal timestamps, a `shipping` object with the copied nine fields,
and UUID-sorted `items` with IDs, quantity, currency, authoritative prices/totals,
names, SKU and size/color. It contains no inventory counts, request fingerprint,
user identity, lock information or service metadata. Lifecycle status/timestamps
can evolve; the commercial and shipping snapshots remain original.

Expected domain failures use SQLSTATE P0001 and an `EVO_STORE_CHECKOUT_` message:
AUTH_REQUIRED, EMPTY, TOO_MANY_LINES, INVALID_ITEM, DUPLICATE_VARIANT,
INVALID_QUANTITY, CURRENCY_INVALID, IDEMPOTENCY_INVALID, IDEMPOTENCY_CONFLICT,
ACTIVE_EXISTS, INVALID_VARIANT, UNAVAILABLE, PRICE_MISSING, PRICE_INVALID,
OUT_OF_STOCK, ADDRESS_INVALID, NOT_FOUND, ALREADY_CONSUMED, STATE_CONFLICT and
RECONCILIATION_REQUIRED. Integrity, conversion/overflow, deadlock and serialization
exceptions inside the RPC are translated to STATE_CONFLICT. The future API must
map the stable message and avoid returning database diagnostic context to clients.

`011_store_checkout_reservations.sql` tests privileges, malformed/authority-bearing
input, ownership, catalog/readiness, prices, exact arithmetic, shipping/item
snapshots, replay/order invariance, immutable snapshots after changes, archival
release, lazy expiry and rollback, reconciliation and terminal states. Complete
before/after row comparisons prove generic commerce and movement isolation.
`fixtures_store_checkout.sql` contains only synthetic disposable data.
`store-checkout-concurrency.mjs` launches separate psql transactions for last-unit,
same-key replay/conflict, opposite cross-product request order, multiline failure,
release races, competing lazy-expiry replacements and valid-active rejection. It
also exercises distinct keys on an empty lifecycle, crossed old/new expiry sets,
release versus lazy expiry and archive-first revalidation. Statement timeouts bound
races; failed requests and counts/aggregates are asserted. Both suites run through
the existing fail-closed bootstrap without altering the baseline or the Phase 2J-A
process/metadata regression protections.

No UI/API, global expiry, consumption, cron, persistent cart, shipping/tax,
Store orders/payments, Vault or Razorpay change is part of this migration.
Local structural tests cannot establish PostgreSQL execution or concurrency
correctness; disposable database CI must pass before merge.
