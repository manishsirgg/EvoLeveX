# EvoLeveX × Printful — Phase A compatibility gate (2026-10-09)

Status: architecture review; NO schema, checkout, deployment, or production changes authorized by this document.

## Verified implementation facts
- Evo Store products are `physical | digital | hybrid` and `draft | published | archived`; categories are a two-level hierarchy with leaf-only assignments.
- Existing admin variant fields include SKU, optional size/color, weight, and sort order. Variant prices are separately managed.
- Inventory UI uses `quantity_on_hand - quantity_reserved` and manual stock adjustments.
- The storefront currently treats variants as `in_stock | out_of_stock | unavailable` using database availability; it cannot infer Printful fulfillment eligibility.
- Images use Supabase Storage and signed URLs, with a file upload path; remote Printful mockups require validated import, not direct insertion of remote URLs.
- Current checkout expiry worker acquires checkout/variant/product locks and releases reservations. We must not alter this path without auditing every checkout/reservation/payment call site and validating concurrency.
- Printful API v1 'Sync Products' and 'Sync Variants' identify configured products distinct from blank catalog variants. API v2 preview uses 'My Products'. The initial adapter should explicitly target a verified stable API contract.

## Compatibility decision
The Fashion category taxonomy is a local merchandising taxonomy. Do not import/mirror all Printful categories. Store EvoLeveX category assignment independently.
Do not encode supplier identity in SKU, category slug, or product UUID. Use separate constrained mapping tables after inventory/checkout invariants are understood.
Printful products must enter as **draft**, with no product publication, customer-facing availability, orders, or automatic fulfillment during Phase A.

## Proposed data model (NOT YET A MIGRATION)
1. Provider connection metadata: provider, account/store identifier, enabled state, API version, last successful check; NEVER save token in SQL.
2. Product map: local product UUID, Printful Sync Product ID, store identifier, external ID, last synchronized timestamp, checksum; unique within provider/store.
3. Variant map: local variant UUID, Sync Variant ID, Catalog Variant ID, sync status, external ID; reject mappings to a different product.
4. Sync runs: request idempotency key, operation, cursor, status, counts, safe error code; no credentials or buyer data.
5. Future fulfillment order mappings and webhook inbox belong to a separate later phase.

## Mandatory design decisions before migration
- Identify the exact live source of `in_stock` and how the existing readiness function enforces inventory.
- Trace cart/checkout creation, hold reservation, expiry, payment confirmation and stock decrement. Preserve lock ordering, idempotency and transactional guarantees.
- Determine if POD checkouts should use separate reservation/fulfillment branches, or an explicit inventory policy coupled to availability; NEVER insert fictional positive stock.
- Decide which system owns product text, prices, images and customer-facing availability, and how partial sync failures roll back.
- Document provider availability and destination-dependent shipping; never promise an item is fulfillable solely because it exists in Printful.
- Inspect all production migration deployment prerequisites and non-idempotent DDL before applying any script.

## Acceptance gates for the first schema PR
- Add only backward-compatible nullable/defaulted fields or new tables, with RLS on all exposed tables.
- Authenticated customers cannot read private mapping, sync logs, or provider credentials.
- Existing stocked-product availability, published listings, cart/checkout, expiry, payment and refunds work unchanged on PostgreSQL 15 and 17.
- Migration tests cover duplicate provider IDs, cross-product variant mapping, re-import idempotency, permission boundaries, and rollback.
- No Printful HTTP calls or real orders in CI; mocked fixture responses only.
- No auto-sync, no production DDL, no token handling in the browser, and no automatic deployment of unreviewed migration.

## Suggested implementation slices
A1. Complete checkout/readiness source audit and define invariants.
A2. Draft migration plus isolated integration tests; review in a draft PR.
B1. Server-only read-only client for Printful configured products (first test on a safe preview env).
B2. Explicit admin import into drafts and mockup ingestion.
C. Provider-specific inventory eligibility and controlled checkout, then fulfillment / webhook integration.

Reference: https://developers.printful.com/docs/ (stable API v1), https://developers.printful.com/docs/v2-preview/ (preview).
