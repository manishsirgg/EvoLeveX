# PR #288 — Real Store owner-only atomic correlation integration

The existing disposable PostgreSQL 15/17 Store operator-gate integration creates a real synthetic Store checkout/order/intent/attempt. This change uses the **actual** `private.execute_evo_store_correlation_atomically` owner-only function for a successful correlation, then asserts the real nonce ledger row, correlated attempt state, created result, retry idempotence through the existing audit function and replay rejection. The preexisting invalid-provider-evidence test checks nonce rollback and absence of mutation.

This is a **test of real schema and transaction mechanics, not a worker privilege grant**. The disposable test connection uses database-owner privilege and sets the operator session claim. That would be unsafe as production authentication: auth.uid()/session GUC can be forged by SQL logins. Production deployment still requires a trusted ticket issuer, independently authenticated worker and database-side authorization bound to real operator identity; provider evidence must be independently verified.

No production SQL migration, new credential, public RPC, worker connection or Razorpay/Printful enablement. Payment readiness remains false.
