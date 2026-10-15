# PR #238 — Store Razorpay provider order boundary

## Current production facts
- The Store claim function `public.claim_evo_store_razorpay_intent(uuid,uuid)` and private claim table exist in production (verified 2026-10-15).
- Claim responses deliberately report `provider_order_created=false` and `payment_ready=false`.
- Existing `src/lib/razorpay.ts` has a Vault-used `createRazorpayOrder` helper; it does not establish Store provider correlation.
- No Store payment initiation, settlement, capture reconciliation, or fulfillment authorization is permitted at this checkpoint.

## Non-negotiable provider design gates
1. Keep `STORE_RESERVATION_BRIDGE_ENABLED=false` and customer Store payment initiation disabled; do not add a public API endpoint during this preliminary step.
2. Before any API POST, implement an **atomic, server-authorized, claim-bound lease/state transition** with persisted metadata and a deterministic request identity. Do not hold SQL row locks over external HTTP.
3. Verify order owner, active reservation, valid immutable financial snapshot, approved merchant clearance and currency support on the server. Client values cannot set amount/currency.
4. Verify account-specific supported currencies independently; a locally supported `JPY` currency does not prove the connected Razorpay account supports it.
5. Persist success response provider order ID, amount, currency and receipt under strict uniqueness/correlation constraints, with no payment settlement.
6. A transport timeout, HTTP 5xx or malformed response after POST is **ambiguous**. Persist `reconciliation_required` and DO NOT blindly repeat the provider POST. Recovery must verify provider-side state by a deterministic correlation mechanism and/or manual operator review.
7. An unambiguous refusal may be terminal, but classification must be supported by provider API semantics; reject unsafely assumed retries.
8. Provider-order creation must not set `orders.payment_status=paid`, mutate inventory, fire Printful requests, issue entitlements or invoke Vault reconciliation.
9. The Store provider identifier and merchant order must be uniquely correlated; no Vault payment table reuse without explicit security review.
10. Add PG15/PG17 concurrency tests, fault injection for external responses, duplicate receipts, timeouts, server restarts, and stale claims before enabling this integration.

## PR boundary
This initial PR is a **documented review gate** only. It does not create an API route, add provider credentials, submit provider orders, or migrate payment tables. Complete implementation and tests in follow-up commits before marking ready to merge.

## Production checks before rollout
- Confirm all required DB migrations are installed and security grants remain correct.
- Confirm production feature flags are disabled.
- Verify Razorpay test-account capabilities and reconciliation API semantics from official documentation.
- Require manual security/financial review before enabling any non-test provider POST.
