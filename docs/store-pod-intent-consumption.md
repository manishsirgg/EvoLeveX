# POD signed-intent durable consumption ledger — PR #380

A verified Ed25519 signature (PR #379) is not single-use by itself. This migration introduces an immutable, private once-only ledger that a **future independently authenticated worker** must insert in the SAME database transaction as a non-payable POD quote. The migration creates no worker, insert path, consumer RPC, API route, privileges or RLS policies.

## Guarantees at the database boundary

- `unique(worker_id,nonce)` prevents reusing the same signer-scoped nonce, even on a different quote.
- `unique(customer_id,idempotency_key)` and `unique(quote_id)` prevent a second claim for the same customer intent or quote.
- A composite foreign key to `(quote_id,customer_id,idempotency_key)` on the immutable quote header prevents attaching a consumption to another customer or idempotency key.
- Proofs must have a validity window no greater than 60 seconds. The insert trigger verifies the validity window against PostgreSQL `statement_timestamp()` and overwrites any supplied consumed-at value with server time.
- An UPDATE/DELETE trigger rejects mutation of consumed evidence. Consumption survives quote expiry; no cleanup/reset process exists.
- RLS is enabled and ALL privileges are revoked from PUBLIC, anon, authenticated and service_role. No new policy or grant is included.

## What this does NOT establish

The ledger does not check an Ed25519 signature itself, the authenticity of worker-provided values, correct tax or Printful source provenance, or that a quote was constructed from an authorized customer request. A forged insert from a future overly privileged actor would still be possible. The trusted worker must independently verify all inputs and signature, bind expected worker and nonce from an independent context, then atomically insert quote, quote lines and consumption in one serializable transaction. Existing PR #374 writer is NOT wired to this ledger yet. It must not be connected without updating the atomic write path and reviewing role-specific access and nonce conflict recovery.

## Rollout

Merge only after disposable PostgreSQL integration and application CI pass. **GitHub/Vercel deployments do not apply Supabase SQL migrations**. Review and apply this migration separately to the linked Supabase project after merge, then verify ledger existence, constraints, private privileges and triggers. Do not apply it twice.

All customer checkout, publication, Razorpay and Printful order execution remains disabled.
