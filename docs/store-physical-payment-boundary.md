# Evo Store physical payment boundary (PR #219)

## Verified Production functions (2026-10-14)

- `public.create_evo_store_checkout(jsonb,text,uuid,uuid)` creates an idempotent, owner-bound 30-minute stock hold in `evo_store_checkouts` and `evo_store_checkout_items`; it does **not** create `orders`, `order_items` or `payments`.
- `private.lock_evo_store_checkout_inventory(uuid[],uuid[])` serializes parent-product and inventory locks.
- `private.finish_evo_store_checkout_hold(uuid,evo_store_checkout_status)` only supports `released` and `expired`, and decrements `quantity_reserved`. It must never run on a consumed hold.
- `public.expire_evo_store_checkouts(integer)` is the existing service-role expiry worker.
- `public.reserve_razorpay_payment(uuid)` currently requires exactly one `evo_vault` book order item.
- `public.reconcile_captured_razorpay_payment(...)` currently requires an Evo Vault book and invokes `fulfill_confirmed_evo_vault_order`.
- `public.attach_razorpay_order(uuid,text)` is an existing correlation helper; its deadline semantics currently operate on `orders` and must be reviewed in Store-specific tests.

## Non-negotiable payment invariants

1. Never dispatch merchant-fulfilled Store items through Evo Vault digital delivery or a Printful integration.
2. A Store checkout hold is not a paid order and cannot be treated as proof of payment.
3. Price, variant eligibility, product publication, shipping address and stock originate from locked, server-side data, never from browser fields.
4. Convert hold to local pending order and payment atomically, idempotently and with explicit ownership of the hold; snapshot all `store` order items and full shipping address.
5. Shipping and tax must be determined and included before creating the final payable Razorpay order. Do not substitute zero without an explicit merchant pricing policy.
6. Razorpay amount, currency, provider order and payment IDs must be reconciled against canonical captured provider state; webhook signature alone is insufficient.
7. Paid-order confirmation and hold consumption must be the same atomic database transaction, with order-first lock ordering consistent with expiry and cancellation.
8. Expired holds must never be silently resurrected after late provider capture. Late captures require a separate, auditable refund or manual reconciliation path.
9. Duplicate browser callbacks and webhook events must converge to the same terminal state without duplicate stock deductions, refunds or shipment requests.
10. Keep `STORE_RESERVATION_BRIDGE_ENABLED=false` until Store payments, expiry, reconciliation, and fulfillment transitions pass concurrent integration tests.
11. Preserve Printful draft and inactive variant status until the provider fulfillment workflow has its own validation.

## Proposed next implementation (separate migration; not included here)

- Guarded, authenticated `create_pending_evo_store_order(checkout_uuid)` / equivalent that binds the live reservation to an `orders` row and snapshots items; avoid premature payment when shipping/tax are unknown.
- Store-specific Razorpay reservation and captured-payment reconciliation functions while retaining shared validated provider utilities and event receipts.
- One-way inventory transition: on verified capture decrement `quantity_on_hand` and `quantity_reserved` once per purchased unit and mark hold consumed. Record stock movement with order reference; keep reservation-only movements out of audit ledger.
- End-to-end duplicate, expiration, last-item contention, cancellation and late-capture database integration tests on disposable local PostgreSQL.
- Merchant fulfillment state and customer order history afterwards.

### Scope

This PR is a security/integration contract and regression gate only. It does not create or capture payments, initiate stock mutations, enable checkout, or alter Supabase production schema.
