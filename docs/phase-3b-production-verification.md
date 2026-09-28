# Phase 3B production verification

Apply `supabase/migrations/20260928020000_trusted_multicurrency_vault_checkout.sql`
manually through the approved production migration workflow. Do not run the cases below
before the migration has been reviewed and applied.

## RPC and privilege checks

1. Confirm `public.create_pending_evo_vault_order(uuid)` no longer exists.
2. Confirm only `public.create_pending_evo_vault_order(uuid,text)` exists, is `SECURITY DEFINER`,
   has an empty `search_path`, and is executable by `authenticated` but not `anon` or `PUBLIC`.
3. Confirm `reserve_razorpay_payment(uuid)` retains the same security and grants.
4. Confirm no historical commerce row was modified by the migration.

## Authenticated order matrix

Use a new test customer without an active entitlement and a paid, active, deliverable digital
book. Inspect the resulting `orders` and single `order_items` row after each call.

| Canonical/requested | Expected result |
| --- | --- |
| USD / USD | Identity price without an FX cache row |
| USD / INR | Trusted cache rate, rounded to two decimals |
| USD / EUR | Trusted cache rate, rounded to two decimals |
| USD / JPY | Trusted cache rate, rounded to zero decimals and stored in `numeric(14,2)` |
| non-USD / same currency | Identity price without an FX cache row |
| non-USD / different currency | Rejected as unsupported automatic conversion |
| unsupported, blank, or null requested currency | Rejected |
| missing USD quote row | Rejected |
| rate fetched 30–72 hours ago | Accepted as bounded-stale |
| rate fetched more than 72 hours ago | Rejected as expired |
| rate fetched more than five minutes in the future | Rejected |
| zero or negative rate (if validation can be exercised transactionally) | Rejected |

Repeat a request with the same resolved currency and amount and confirm `created = false`.
Change the cache rate enough to alter the rounded amount and confirm a new order is created;
change it without altering the rounded amount and confirm reuse is allowed. Confirm every reused
order has zero adjustments and exactly one matching quantity-one Evo Vault item.

## Payment and historical-chain checks

1. Reserve a Razorpay payment for each newly created USD, INR, EUR, and JPY order.
2. Confirm payment amount and currency exactly equal the immutable order snapshot.
3. Change the current product catalog price/currency and confirm reservation of an already-created
   test snapshot does not reprice it or consult FX. Roll back the test catalog change.
4. Confirm JPY `1955.00` is sent to Razorpay as integer subunits `1955`, while INR `1246.10`
   is sent as `124610`.
5. Verify order `9f5f41b5-8524-4fab-9de6-270ce4e9ddb1`, payment
   `5214972d-019e-4e3b-8dcc-734a2f57a4f5`, and provider order `order_Th4GKqHfzrOMzK`
   remain unchanged at USD 12.99.
6. Confirm an INR request for product `1c50700d-8b48-452b-b9f6-54b6fa7436e4` does not reuse that
   USD order and creates an independent payment/provider relationship.
7. Confirm neither order creation nor reservation reads `public.evo_vault_product_prices`.

Do not enable the customer-facing Buy Now control or remove the legacy price table until this
matrix has passed.
