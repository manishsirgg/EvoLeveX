# EvoLeveX Printful Phase A2 — Checkout dependency audit

Date: 2026-10-09. Scope: source inspection only. No database/API/token changes.

## Confirmed dependencies

1. `supabase/migrations/20261006010000_evo_store_transactional_inventory_reservations.sql` implements `public.create_evo_store_checkout(p_items, p_currency, p_idempotency_key, p_address_id)`. The function validates one-to-ten quantity per variant, accepts an array of variants, canonicalizes request items, calculates a deterministic request fingerprint, and locks on a per-user advisory key before checking prior idempotent requests.
2. It also calls `private.lock_evo_store_checkout_inventory(locked_variants, snapshot_products)`, which locks product rows (ordered by id), confirms variant ownership is unchanged, and locks inventory rows (ordered by variant_id).
3. `private.finish_evo_store_checkout_hold` rejects missing inventory or insufficient reserved units with `EVO_STORE_CHECKOUT_RECONCILIATION_REQUIRED`. Successful release/expiry decrements inventory.quantity_reserved and transitions checkout status.
4. Checkout expiry worker (`20261008125840_evo_store_checkout_expiry_worker.sql`) reuses this hold-finalization function and lock ordering. This is a critical compatibility boundary.
5. Storefront (`src/lib/storefront.ts`) exposes only `in_stock | out_of_stock | unavailable` from existing availability queries and signs Supabase-hosted product images.
6. Admin inventory currently tracks `quantity_on_hand`, `quantity_reserved`, and available stock. There is no equivalent POD provider availability in inspected admin models.
7. `tests/database/helpers/bootstrap.mjs` provisions dedicated disposable databases for test execution; concurrency tests exist in `tests/database/store-checkout-concurrency.mjs`.

## Design verdict
**Do not introduce POD items into the existing stock reservation path.** The current finalization and expiry logic assumes that every line has an actual reserved stock row; using fake stock quantities would break inventory semantics and conceal provider outages.

Proposed evolution, pending deeper SQL review:
- Keep current checkout path unchanged for stock-managed merchandise.
- Add provider mappings separately with private-by-default access and unique external identity constraints.
- Define an explicit fulfillment strategy per variant/product, with immutable checkout snapshot of strategy and provider references.
- Implement a separate reservation/confirmation strategy for POD items with destination-specific eligibility and quotes; the existing checkout idempotency, customer lock, money snapshots, and terminal-state invariants must be preserved.
- For mixed-provider baskets, use one atomic checkout coordination design and test partial failure/expiry; otherwise *explicitly disallow mixed fulfillment baskets* until this is implemented.
- Paid-order submission, shipment tracking, and webhooks require a later reviewed phase.

## Open source-code inspection before DDL
- Inspect the rest of `create_evo_store_checkout` line validation and stock mutation, including price snapshots and existing expiration processing.
- Inspect `inspect_evo_store_product_readiness`, any `evo_store_variant_availability` view/function, payment confirmation/consumption, and refund integration.
- Review all RLS, triggers, permissions and grants for the new mapping tables.
- Establish an exact API version and store identifier; never put tokens in SQL or browser code.

## Safety and acceptance
- Zero changes to production data and existing checkout SQL in this audit PR.
- No automatic Printful orders, webhooks, imports, or product publication.
- Require Postgres 15/17 tests for existing checkout, concurrency, expiry and RLS plus new fulfillment scenarios before deployment.
- Deployment of future migrations must be explicit and separately verified.
