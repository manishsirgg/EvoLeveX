# POD quote integrity — PR #372

The original POD quote snapshot schema (PR #369) intentionally has **no writer grants**. PR #372 strengthens the schema before introducing any quote writer.

A pair of **DEFERRABLE INITIALLY DEFERRED** constraint triggers verifies, at transaction commit, that each quote contains 1–50 lines, each line points to the correct private Printful product and variant mapping, that both mapping rows are synced, the recorded SKU and provider IDs match the authoritative rows, and that the sum of all line subtotals equals the quote header subtotal. The quote header is locked during validation so concurrent writers cannot silently bypass a completed validation.

The quote's financial and identity evidence is immutable after insertion. Only transitions from `prepared` to `expired` or `invalidated` are permitted; terminal states cannot return to `prepared`. All line updates and deletions are rejected. Existing CHECK constraints permanently prohibit payment and fulfilment readiness.

## Migration rollout

- PR requires disposable database integration and application validation to pass before merge.
- Review the target Supabase project and migration history. GitHub/Vercel deployments do not automatically apply SQL migrations.
- Apply the reviewed migration through the production migration workflow **after merge**, then inspect the four new triggers and two functions in the target database.
- Do not grant direct INSERT/UPDATE to client or service roles or switch on any payment/fulfilment feature flag.

## Work still required

The next restricted quote writer must establish customer address ownership, fresh provider mapping/production evidence, destination-specific full-cart shipping, exact applicable tax and monetary currency/rounding, provider option selection, expiry, full transaction-level idempotency and auditable operator identity. The deferred constraints reject many malformed snapshots but **do not certify** those external inputs. A merchant should not be charged based on the mere presence of a quote.
